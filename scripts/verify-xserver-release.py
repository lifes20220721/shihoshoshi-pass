#!/usr/bin/env python3
"""Read-only HTTPS/SHA-256 check against one prepared static release manifest."""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=pathlib.Path)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    if manifest['domain'] != 'shihoshoshipass.com':
        raise ValueError('Unexpected deployment domain')
    files = manifest['files']
    if len({row['path'] for row in files}) != len(files):
        raise ValueError('Duplicate manifest paths')
    for row in files:
        path = row['path']
        if path.startswith('/') or '..' in path.split('/') or urllib.parse.urlsplit(path).scheme:
            raise ValueError('Unsafe manifest path')

    def check(row):
        url = 'https://shihoshoshipass.com/' + urllib.parse.quote(row['path'], safe='/')
        result = {'path': row['path'], 'expectedSha256': row['sha256']}
        try:
            request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'PASS-release-readonly-check/1'})
            with urllib.request.urlopen(request, timeout=25) as response:
                final = urllib.parse.urlsplit(response.url)
                if final.scheme != 'https' or final.netloc != 'shihoshoshipass.com':
                    raise ValueError('Unexpected redirect host or protocol')
                body = response.read(max(row['bytes'] + 65536, 1048576))
                result.update(httpStatus=response.status, sha256=hashlib.sha256(body).hexdigest(), bytes=len(body))
                result['match'] = response.status == 200 and result['sha256'] == row['sha256'] and len(body) == row['bytes']
        except (OSError, ValueError) as error:
            result.update(match=False, error=str(error))
        return result

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        rows = list(executor.map(check, files))
    report = {'checkedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'domain': manifest['domain'], 'sourceCommit': manifest.get('sourceCommit'),
              'requestMethod': 'GET', 'tlsVerificationDisabled': False,
              'fileCount': len(rows), 'matched': sum(row['match'] for row in rows),
              'allMatch': all(row['match'] for row in rows), 'files': rows,
              'remoteChangesPerformed': False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['fileCount', 'matched', 'allMatch', 'remoteChangesPerformed']}))
    raise SystemExit(0 if report['allMatch'] else 1)


if __name__ == '__main__':
    main()
