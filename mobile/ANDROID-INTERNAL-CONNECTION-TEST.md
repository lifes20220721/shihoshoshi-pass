# Android内部テスト v4：アプリ間リンクと旧サーバー時刻

## 対象と現在の準備

- 司法書士PASS `com.shihoshoshipass.app`、versionCode **4**、versionName **1.2.0-internal**。
- 配信済みv2の審査用ログイン・課金設定・公開鍵・教材固定コミット・保存キーを維持する。
- v3は紹介特典を有効にした未配信の検証用成果物なので、今回の接続確認には使用しない。
- 今回は `referralTrialEnabled:false`、`connectionTestEnabled:true` の内部テストビルドを作る。
- 通常ビルドでは接続テスト画面も紹介特典も既定で無効。接続テストと紹介特典の同時有効化はビルド時に拒否する。
- XServerへの配置、DNS・SSL変更、PR #1のマージ、productionトラックへの公開は行わない。

## 接続確認の内容

Androidのホーム下部に「もう一つの資格アプリ」→「行政書士PASSをGoogle Playで見る」を表示する。
URLのアプリIDは `com.gyoseishoshipass.app`。紹介元パラメーターは付くが、この司法書士ビルドに紹介特典の利用権は付与しない。

「ホーム」→「学習通知・バックアップ」→「接続確認（内部テスト）」→「サーバー時刻を確認する」で、
Androidのネイティブ処理が `https://xs968799.xsrv.jp/pass-review/healthz?clock=<ランダム値>` にHTTPSのHEADを送る。
200応答のDateヘッダーを取得し、取得成功時に日本時間で表示する。端末の現在時刻を成功結果として代用しない。
リダイレクトは許可せず、接続・読取は各5秒でタイムアウトする。通信失敗時は失敗表示になる。
この操作はGoogle Play Install Referrerの取得や、購入・審査・紹介権限の変更を行わない。

## ビルド

1. このブランチの対象コミットを固定する。
2. `node scripts/fetch-sources.mjs` で固定教材を取得する。
3. `npm test` と `python3 -m unittest discover -s automation -p 'test_*.py' -v` を実行する。
4. `node scripts/configure-internal-connection-test.mjs`、`npm run build`、`node tests/reviewer-ui.cjs` を実行する。
5. 新規Androidプロジェクトに `npm run native -- shihoshoshi android`、`node scripts/prepare-internal-android.mjs` を適用する。
6. `bundleRelease` を作成し、従来と同じアップロード鍵で署名する。鍵・パスワード・審査アカウントはAABやGitHubへ含めない。
7. package、versionCode、署名証明書、同梱アセット、紹介特典false、接続テストtrue、旧サーバーURL、秘密情報の混入がないことを検査する。

CI `Build Android internal test bundle` は未署名v4を作成する。これは端末へ直接インストールするファイルではない。
署名済みAABをPlayの内部テストへ登録して配信し、利用者はGoogle Playから更新する。

## 内部テストへの配信

認証は既存の `.github/workflows/play-draft-upload.yml` と既存Workload Identityを使用し、IAM条件や認証範囲を広げない。
`automation/play-draft-request.json` の `mode:internal-connection` で、
`automation/play-internal-request.json` の `check` または `publish-internal` を処理する。

先に読み取り検査し、現在の内部トラックが完了済みv2であること、versionCode 4が衝突しないことを確認する。
配信時は対象Driveファイルのサイズ・SHA-256と署名済みAABの形式を検査してから、internalトラックだけをv4へ更新する。
production等の他トラックは更新せず、編集前後と確定後に一致を検査する。
`changesNotSentForReview=true` で確定し、失敗時に別の審査送信条件へ自動再試行しない。
API確定に失敗した場合は、作成済みAABとConsoleの内部テスト画面を使って利用者が進められる状態を報告する。
テスターのリストや参加資格は変更しない。

## Android実機での手順

1. Google Playを開き、既存の登録テスター `life.s.20220721@gmail.com` を使用していることを確認する。
2. 既に内部テストv2を入れている端末では、司法書士PASSのPlayページから **更新** する。学習履歴を保つためアンインストールしない。
3. 初参加の場合は `https://play.google.com/apps/testing/com.shihoshoshipass.app` で同じアカウントにログインし、テスター参加後にGoogle Playへのリンクからインストールする。
4. Androidのアプリ情報で **1.2.0-internal** を確認する。反映待ちの場合はしばらく置いてからPlayのページを開き直す。
5. ホーム下部の「行政書士PASSをGoogle Playで見る」を押し、対象アプリのページへ進むことを確認する。
   行政書士側が未公開または内部テスト限定の場合は、そのアプリの配信・テスター参加条件を別途満たす必要がある。ページが非表示という結果だけでURL実装の誤りとは判定しない。
6. 「学習通知・バックアップ」→「サーバー時刻を確認する」で **取得成功** と表示時刻を確認する。
7. 通信を切った状態で再度押すと **取得失敗** となり、無料の全機能権限が追加されないことを確認する。確認後は通信を戻す。
8. 既存の途中位置が保たれること、審査ログイン・全教材表示を再確認する。購入操作は今回の接続テストに不要。

ユーザーの実機確認が終わるまでは、時刻取得とPlayページ遷移を「実機確認済み」と記録しない。

## 作成済み成果物

[署名済みv4 AAB](https://drive.google.com/file/d/1RMN3qa_GkyB0zFXqo46osjq5geUtoPps/view) を作成済み。所有者と既存アップロード用サービスアカウントのreaderのみ。CIの固定コミットと45アセットが一致し、従来アップロード証明書による署名、紹介特典false、接続確認trueを検査済み。配信状態は [結果記録](ANDROID-INTERNAL-V4-RESULT.json) を参照。AABは端末へ直接入れず、Google Playの内部テスト更新で受け取る。
