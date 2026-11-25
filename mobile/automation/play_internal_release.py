"""Publish only an owner-authorized internal connection-test bundle; no production track writes."""
import argparse
import json
import os
import re
from pathlib import Path
import urllib.parse

from play_draft_upload import GoogleClient, SafeError, verify_bundle, PUBLISHER, UPLOAD, PACKAGE


def snapshot_other_tracks(tracks):
    return {row['track']: row for row in tracks if row['track'] != 'internal'}


def run(config, client):
    if config.get('package_name') != PACKAGE or config.get('track') != 'internal' or config.get('version_code') != 4:
        raise SafeError('Only the approved judicial internal version 4 is supported')
    if config.get('mode') not in ('check', 'publish-internal') or config.get('previous_internal_versions') != ['2']:
        raise SafeError('Unexpected internal-release request')
    if config.get('referral_benefits_enabled') is not False:
        raise SafeError('Referral benefits must remain disabled')
    publish = config['mode'] == 'publish-internal'
    if publish:
        if not re.fullmatch(r'[a-f0-9]{64}', config.get('sha256', '')) or not re.fullmatch(r'[A-Za-z0-9_-]{10,100}', config.get('drive_file_id', '')):
            raise SafeError('Expected signed bundle reference and hash are required')
        if type(config.get('size')) is not int or not 1000 <= config['size'] <= 150000000:
            raise SafeError('Invalid expected bundle size')
    edit = None
    try:
        edit = client.request('POST', PUBLISHER + '/edits', {})['id']
        base = PUBLISHER + '/edits/' + urllib.parse.quote(edit, safe='')
        bundles = client.request('GET', base + '/bundles').get('bundles', [])
        tracks = client.request('GET', base + '/tracks').get('tracks', [])
        others = snapshot_other_tracks(tracks)
        track = next((row for row in tracks if row['track'] == 'internal'), {'releases': []})
        releases = track.get('releases', [])
        versions = [str(config['version_code'])]
        existing = next((b for b in bundles if str(b['versionCode']) == versions[0]), None)
        if existing and publish and existing.get('sha256', '').lower() != config['sha256']:
            raise SafeError('Version 4 is already assigned to another bundle')
        already = len(releases) == 1 and releases[0].get('status') == 'completed' and releases[0].get('versionCodes') == versions
        previous_ok = len(releases) == 1 and releases[0].get('status') == 'completed' and releases[0].get('versionCodes') == config['previous_internal_versions']
        if not already and not previous_ok:
            raise SafeError('The internal release is not the expected completed version 2; no changes committed')
        if not existing and any(int(b['versionCode']) >= config['version_code'] for b in bundles):
            raise SafeError('A newer version code already exists; no changes committed')
        result = {'package': PACKAGE, 'internal_versions': [r.get('versionCodes', []) for r in releases],
                  'internal_statuses': [r.get('status') for r in releases],
                  'registered_version_codes': [b['versionCode'] for b in bundles],
                  'production_track_written': False, 'changes_committed': False}
        if not publish:
            return result
        if already:
            if not existing:
                raise SafeError('Completed version is missing from bundle inventory')
            return dict(result, already_available=True)
        data = client.request('GET', 'https://www.googleapis.com/drive/v3/files/' + config['drive_file_id'] + '?alt=media', raw=True)
        verify_bundle(data, config)
        if not existing:
            uploaded = client.request('POST', UPLOAD + '/edits/' + urllib.parse.quote(edit, safe='') + '/bundles?uploadType=media', data, raw=True)
            if isinstance(uploaded, bytes):
                uploaded = json.loads(uploaded)
            if int(uploaded.get('versionCode', -1)) != config['version_code'] or uploaded.get('sha256', '').lower() != config['sha256']:
                raise SafeError('Uploaded version or checksum mismatch')
        release = {'name': '司法書士PASS 内部テスト v4 - 接続確認', 'versionCodes': versions, 'status': 'completed',
                   'releaseNotes': [{'language': 'ja-JP', 'text': '行政書士PASSへのGoogle Playリンクと、旧サーバーからの時刻取得を確認する内部テスト版です。紹介特典は無効です。'}]}
        client.request('PUT', base + '/tracks/internal', {'track': 'internal', 'releases': [release]})
        updated = client.request('GET', base + '/tracks').get('tracks', [])
        if snapshot_other_tracks(updated) != others:
            raise SafeError('A non-internal track changed inside the edit; no commit attempted')
        client.request('POST', base + ':validate', {})
        omitted_unsupported_flag = False
        try:
            client.request('POST', base + ':commit?changesNotSentForReview=true', {})
        except SafeError as error:
            if not getattr(error, 'unsupported_review_flag', False):
                raise
            # This edit was created here and only PUT /tracks/internal was called.
            # Omit the flag only when Google explicitly says it must not be set.
            retry_tracks = client.request('GET', base + '/tracks').get('tracks', [])
            retry_internal = next((row for row in retry_tracks if row['track'] == 'internal'), {}).get('releases', [])
            if snapshot_other_tracks(retry_tracks) != others or len(retry_internal) != 1 or retry_internal[0].get('versionCodes') != versions or retry_internal[0].get('status') != 'completed':
                raise SafeError('Internal-only edit could not be reverified; no retry attempted')
            client.request('POST', base + ':commit', {})
            omitted_unsupported_flag = True
        edit = None
        edit = client.request('POST', PUBLISHER + '/edits', {})['id']
        checked = client.request('GET', PUBLISHER + '/edits/' + urllib.parse.quote(edit, safe='') + '/tracks').get('tracks', [])
        current = next((row for row in checked if row['track'] == 'internal'), {}).get('releases', [])
        if snapshot_other_tracks(checked) != others or len(current) != 1 or current[0].get('status') != 'completed' or current[0].get('versionCodes') != versions:
            raise SafeError('Commit returned but release readback differs; inspect Play Console')
        return dict(result, changes_committed=True, internal_versions=[versions], internal_statuses=['completed'],
                    unsupported_review_flag_omitted=omitted_unsupported_flag)
    finally:
        if edit:
            try:
                client.request('DELETE', PUBLISHER + '/edits/' + urllib.parse.quote(edit, safe=''))
            except SafeError:
                pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, required=True)
    args = parser.parse_args()
    try:
        config = json.loads(args.config.read_text())
        if config.get('enabled') is not True:
            print(json.dumps({'enabled': False, 'changes_committed': False}))
        else:
            print(json.dumps(run(config, GoogleClient(os.environ.get('PLAY_ACCESS_TOKEN'))), ensure_ascii=False, indent=2))
    except (SafeError, ValueError) as error:
        raise SystemExit(str(error))
