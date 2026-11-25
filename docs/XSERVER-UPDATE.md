# 司法書士PASS Web版の更新・バックアップ・切り戻し

## 公開先と管理範囲

| 項目 | 値 |
| --- | --- |
| GitHub | `lifes20220721/shihoshoshi-pass` |
| 作業ブランチ | `codex/store-apps-preparation`、下書きPR #1。マージは別途判断 |
| 公開URL | `https://shihoshoshipass.com/`（wwwも確認対象） |
| XServer | xs968799 / sv17319.xserver.jp / 85.131.200.80 |
| 配置先 | `/home/xs968799/shihoshoshipass.com/public_html/` |
| FTPホームからの相対配置先 | `shihoshoshipass.com/public_html/` |
| 認証API | `https://xs968799.xsrv.jp/pass-review`。Web更新では変更しない |

2026-11-25時点で、ユーザーからWeb版のDNS切替後のHTTPS・実機表示・解答保存・関連リンク確認の完了報告を受けている。今回のソース整備・文書作成では、本番書き込みを行っていない。

GitHubでソースを管理し、検証済みの同一コミットから配布物を作り、別工程でXServerへ配置する。GitHubへのpush、PR作成、CI成功だけではXServerは更新されない。GitHub Pagesの公開機能とXServerへのファイル配置も別である。

この手順は司法書士Web版だけを対象とする。AndroidのAAB/APK、`mobile/apps.json`の教材固定コミット、RevenueCat、審査用アカウント、署名鍵は更新しない。新サーバーxs366651や行政書士サイトには書き込まない。

## ソースを変更して検証する

1. 対象コミットからチェックアウトし、Webの対象ファイルを編集する。既存の問題ID・配列順・localStorageキーを維持する。
2. アイコンを変える場合は `app-icons/` を編集する。`index.html`、`manifest.webmanifest`、`scripts/prepare-release.cjs` の参照も揃える。XServerの `/icons/` はApache共通領域と衝突するため、現行公開版では使わない。
3. 公開ファイルを追加する場合は `scripts/xserver-files.json` の明示リストも更新する。教材JS/CSSの追加時は `scripts/assets.json` も更新する。過去のHTMLや `mobile/` 全体をそのまま公開しない。
4. 次を実行する。依存するツールはNode.js 18以上、Python 3、Git。ブラウザテストにはPlaywrightとChromiumも必要。

   ```sh
   npm run prepare:release
   npm test
   npm run test:browser
   npm run package:xserver
   ```

5. `npm run prepare:release` を再実行して、`index.html` と `service-worker.js` に追加の差分が出ないことを確認する。生成済み `service-worker.js` の直接編集はせず、生成元を更新する。
6. 変更と検証結果を下書きPR #1へ反映する。PRをマージせず、このブランチの固定コミットからも検証用配布物は作れる。

## 配布物を固定する

`npm run package:xserver` はローカルファイルの作成だけを行う。FTPやHTTP書き込み機能はない。

- `release/xserver/site/`: 公開するファイルだけ。現在78件。
- `release/xserver/shihoshoshi-pass.zip`: 上記と同じファイル。`public_html/` の中にZIP階層がもう1段増えない構成。
- `release/xserver/manifest.json`: 元コミット、作業ツリーの変更有無、全ファイルのサイズ・SHA-256。

最終配布物はGitHubへ反映したコミットのクリーンなチェックアウトから再作成する。manifestの `sourceDirty` が `false` であることを確認し、ZIPのSHA-256、コミット、検証結果を同じリリース記録に保存する。ZIPは固定タイムスタンプ・固定順序で生成する。

CIの `Verify learning app` は同じ検証とZIP作成を行い、`shihoshoshi-xserver-static` という成果物を保存する。成果物は本番に転送しない。GitHub Actionsの成果物が期限切れでも、元コミットから再作成できる。

旧 `icons/` 5画像は履歴互換用としてGitHubに残すが、XServer向け成果物には含めない。秘密ファイル、`.git/`、`mobile/`、テスト、配布用ZIPやmanifest自体も公開ファイルに含めない。

## 配置直前に止める場所

現在の依頼範囲はソース・文書整備まで。本番への配置指示が来るまでは、ZIP作成と読み取り専用照合で止める。

将来の配置指示を受けた際は、対象コミット、配布物のSHA-256、配置先、変更ファイル一覧、バックアップ先を揃えてから配置する。mainや別のサイトを誤って参照しない。

## 配置前のバックアップと配置

1. 証明書検証付きFTPSなど、利用者が管理する接続方法でxs968799に接続する。パスワードをソース・ログ・チャットへ記載しない。
2. 非公開の `/home/xs968799/.pass-placement/<日時>-<コミット先頭>/` を新規の作業単位にする。公開フォルダ外へ、変更前の対象ファイル・存在一覧・SHA-256を保存する。過去のバックアップは上書きしない。
3. 初回は78件全体をバックアップ対象とする。新規追加ファイルは「元は存在しない」と記録する。バックアップを読み戻してハッシュを照合し、復元可能と確認してから転送する。
4. ZIPは端末または非公開の作業領域で展開し、manifestと照合する。`site/` の内容だけを配置先へ転送する。ZIPやmanifestを公開フォルダへ置かない。
5. 教材・JS・CSS・`app-icons/` を先に、manifestとHTMLを後に、`service-worker.js` を最後に反映する。サービスワーカーは全キャッシュ対象を取得できた後に切り替わる。
6. 配置先のファイルを読み戻し、manifest全件とSHA-256を比較する。管理対象外ファイルやサーバー上に残る旧 `icons/` は削除しない。

サーバー設定・DNS・SSL・`.htaccess`・認証サーバーの非公開領域には触れない。認証APIやデータベース、署名鍵の初期化・再設置は行わない。

過去の配置処理は行政書士リポジトリにあるが、当時の固定ZIPで両サイトを処理する。
[2026-11-21の処理](https://github.com/lifes20220721/gyoseishoshi-pass/tree/4e1b17f74c02912cf9e26707435281d6189b8ce2/hosting/xs968799)をそのまま再実行して最新ソースの配置とみなしてはいけない。このPRでは別リポジトリやFTP Secretを変更しない。配置自動化を採用する場合は、対象を司法書士サイトと承認済みの新しいmanifestへ限定してから別途実装・検証する。

## 配置後の確認

1. 次の読み取り専用コマンドでHTTPSから全件を取得し、配布物と照合する。差分があれば終了コード1となる。

   ```sh
   python3 scripts/verify-xserver-release.py release/xserver/manifest.json --output release/xserver/https-check.json
   ```

2. 本体とwwwのHTTPS・証明書・転送先、`app-icons`、教材、関連リンクを確認する。HTTPで運用している場合の転送設定は別の変更なので、この手順で自動変更しない。
3. `https://xs968799.xsrv.jp/pass-review/healthz` が200かつ `{"ok":true}` であることを確認する。healthz成功とアプリの審査ログイン成功は別々に記録する。
4. 新しいプライベートタブで表示し、従来の通常タブでも更新・問題解答・保存・再読み込み・オフライン再開を確認する。学習履歴やブラウザデータを消して確認する手順は取らない。
5. GitHubコミット、ZIP・manifestのハッシュ、配置時刻、配置先、バックアップ先、FTP照合、HTTPS照合、実機確認をリリース記録として保存する。

Webの配信元が切り替わっている状況では、現在のDNSとHTTP応答が意図したXServerを指すことも確認する。中継環境で接続先を固定できない場合は、別配信元の成功をXServerの成功と誤判定しない。

## 問題時の切り戻し

1. 差分・エラー・対象リリースを記録し、追加配置を止める。
2. この更新で変更したファイルを、事前バックアップのバイト列へ戻す。教材・画像を先に、HTML・manifestを後に、サービスワーカーを最後に戻す。
3. 元々存在しなかった新規ファイルは一覧に残す。不要ファイルの削除は自動実行しない。残存ファイルが影響する場合は削除対象を明示して別途判断する。
4. 復元後のSHA-256、HTTPS全件、教材表示、履歴の保持を再確認する。バックアップのある旧manifestと検査ツールを使う。
5. Web内容の更新失敗に対する切り戻しではDNSやSSLを変更しない。ブラウザの学習履歴、RevenueCat、審査用アカウント、署名鍵、SQLiteにも触れない。

## 今回の照合記録

[2026-11-25の照合結果](XSERVER-AUDIT-2026-11-25.json)を参照。ライブ78件は前回配置の実効内容と全件一致。今回の配布候補はライブと77件が同一で、サービスワーカー1件は正しい生成手順によるキャッシュ名の更新だけが差分。本番への転送は行っていない。
