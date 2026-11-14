# Google Playの下書きアップロード自動化

現在は準備段階。Google Cloudの初回利用規約に未同意のため、プロジェクト・API・サービスアカウント・認証連携・Play権限はまだ作成されていない。`play-draft-config.json` は `enabled: false` で、実際のAPI操作を開始しない。

## 方式

署名済みのAABをGoogle Driveから取得し、指定したサイズ・SHA256・AAB形式・署名ファイルの存在を確認して、Google Playのinternalトラックへdraft状態だけを保存する。通常の実行はcheckモードで、アップロード・トラック更新・commitを行わない。確認用の一時editは終了時に削除する。

署名用の秘密鍵・パスワード・GoogleのサービスアカウントJSON鍵をGitHubへ送らない。GitHubのOIDCとGoogle Cloud Workload Identity Federationで短時間のトークンを発行する。公開リソース名だけを設定ファイルに入れる。

Google Driveでサービスアカウントへ共有するのは署名済みAABファイル1件だけ。権限はViewer、一般公開はRestrictedのまま。秘密鍵バックアップや他のファイルを共有しない。Play Consoleも司法書士PASSだけの閲覧・テストトラック操作に限定し、本番公開や財務管理の権限は付けない。

## Google Cloud側の接続条件

専用プロジェクトでAndroid Publisher、IAM、IAM Credentials、STS、Drive APIを有効化する。サービスアカウントは `play-draft-uploader`、WIF poolは `github-play-draft`、providerは `github`。Issuerは `https://token.actions.githubusercontent.com`。プロジェクト全体のOwner/Editor権限と長期JSON鍵は不要。

属性：`google.subject=assertion.sub`、`attribute.repository=assertion.repository`、`attribute.repository_id=assertion.repository_id`。

Provider conditionは以下のすべてを要求する。

```text
assertion.repository_id == '1416556302' &&
assertion.repository == 'lifes20220721/shihoshoshi-pass' &&
assertion.ref == 'refs/heads/codex/store-apps-preparation' &&
assertion.workflow_ref == 'lifes20220721/shihoshoshi-pass/.github/workflows/play-draft-upload.yml@refs/heads/codex/store-apps-preparation'
```

サービスアカウントに付ける `roles/iam.workloadIdentityUser` の対象は、このpool内の `attribute.repository/lifes20220721/shihoshoshi-pass` principal setだけにする。poolが他のproviderから認証されないことも確認する。

## 有効化

1. 利用者がGoogle Cloudの初回規約と居住国を確認する。無料トライアルや課金アカウントの登録は本手順では行わない。
2. 専用アカウント、WIF条件、Playのアプリ権限、DriveのAABだけの共有を設定・確認する。
3. `workload_identity_provider` に完全なproviderリソース名、`service_account` に作成したサービスアカウントメールを設定する。これらは秘密鍵ではない。
4. Play Console経由で最初のAABを登録する。公式Edits APIは最初の登録前には使えない。
5. 以上を確認した後にだけ `enabled: true` にし、まずcheckを成功させる。

チェック・下書き作成は `play-draft-request.json` のmodeをcheck/draftにして作業用ブランチへ保存すると実行できる。workflow_dispatchが利用可能になった場合も既定値はcheck。ワークフローファイルを初めて追加した作業用ブランチでは、GitHubの仕様により手動実行ボタンが出ない場合があるため、pushで実行する経路を用意している。

APIは `changesNotSentForReview=true` と `status=draft` を固定する。既存の別リリースを見つけた場合は変更せず停止する。同じAABの既存下書きは保持する。本番トラック、配信開始、審査送信は実装しない。実行中にPlay Consoleを同時編集するとGoogleがAPIのeditを破棄するため、完了を待ってから操作する。

現在のAABは商品登録準備用で、RevenueCat設定・審査用アクセスを組み込んだ販売用ビルドではない。販売用では最新ソースから作成・署名したAABに更新し、チェックサム・サイズ・versionCode・Driveファイルを対応させる。

## 検証

```sh
python3 -m unittest discover -s automation -p 'test_*.py' -v
```

8件のプロセス内テストで、check時の非更新、internal/draft/審査未送信の固定、既存下書きの保持、他リリースの拒否、版・ハッシュ不一致の拒否、一時editの削除を確認。実際のGoogle API接続は初回規約と権限設定の完了後に検証する。
