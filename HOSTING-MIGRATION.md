# PASSサイトのサーバー方針・配置結果（2026年11月21日・日本時間）

現在の方針は **旧サーバー xs968799（スタンダード）への統一** です。
新サーバー xs366651 への移行・ドメイン追加は停止したままです。
本作業ではDNS変更・SSL設定変更・サーバー解約・設定削除を行っていません。

## 旧サーバーへの配置完了

接続先は `sv17319.xserver.jp`、アカウントは `xs968799`、
IPv4は `85.131.200.80` です。専用Secretと証明書検証付きFTPSを使用しました。

| サイト | 配置先（FTPホームからの相対パス） | 公開用ファイルの確認 |
| --- | --- | --- |
| 行政書士PASS | `gyoseishoshipass.com/public_html/` | 29/29：FTP・HTTPともSHA-256一致 |
| 司法書士PASS | `shihoshoshipass.com/public_html/` | 78/78：FTP・HTTPともSHA-256一致 |

HTTP検査は公開DNSを使わず、旧IPv4に各ドメインのHostヘッダーを付けて実施しました。
全107ファイルで200応答と内容一致を確認し、配置・検証ワークフローは成功しました。
配置処理のテスト8件も成功しています。

- 最終配置・検証: https://github.com/lifes20220721/gyoseishoshi-pass/actions/runs/44907488437
- 再現用ソース（固定コミット）: https://github.com/lifes20220721/gyoseishoshi-pass/tree/4e1b17f74c02912cf9e26707435281d6189b8ce2/hosting/xs968799
- 初回の読み取り検査: https://github.com/lifes20220721/gyoseishoshi-pass/actions/runs/44905430922

## 準備済みZIPとXServer互換対応

準備済みZIPを再利用しました。元ZIPのSHA-256は次のとおりで、元ZIP自体は変更していません。

- 行政書士: `29380a2f8a57142e9d31162f17110d7dfa7b3253cc502aaa4ee75f8f7c300ebb`
- 司法書士: `6bdfc075eb8f80e0b1543b9efacbeb462543bf0bc887a57f8cea66420eb26794`

このサーバーの `/icons/` はApache共通ディレクトリへの別名になっており、
配置したサイトのアイコンをHTTPで取得できないことが実測で分かりました。
そのため両サイトの画像5点ずつを `app-icons/` に同じ内容で追加し、
HTML・マニフェスト・サービスワーカーのアイコン参照だけを変更しました。
教材・課金設定・アプリID・署名・公開鍵には変更を加えていません。
元の `icons/` のファイルもFTP上に残しています。
上表の件数は、この互換対応後に公開で使用するファイルの件数です。
Apache設定や `.htaccess` の変更は行っていません。

最初のHTTP検査では反映途中の不一致があり、アイコンの衝突も検出したため再検査しました。
初回処理後のHTTP確認コードの接続処理も修正済みです。最終検査ではいずれも解消しています。

## バックアップ・保持したもの

既存の上書き対象は、公開フォルダの外に保存して転送後に読み戻し確認しています。

- 初回配置前: `.pass-placement/6e282c3559c29b7cc52c/backup/`
- アイコン互換対応前: `.pass-placement/723838e26488c727aa65/backup/`

既存の管理対象外ファイル、サーバー設定、初期ドメインの
`xs968799.xsrv.jp/public_html/pass-review` と
`xs968799.xsrv.jp/pass-review-private` は保持しています。
審査用APIの秘密鍵・アカウント・SQLiteの初期化は行っていません。

2026年11月21日22:17日本時間の確認では、両公開サイトはHTTPSで200、
旧審査用APIの https://xs968799.xsrv.jp/pass-review/healthz もHTTPSで200・ok=trueでした。
両ドメインの公開Aレコードは、作業前後ともGitHub Pagesの
185.199.108.153、185.199.109.153、185.199.110.153、185.199.111.153です。
公開先のDNS切り替えは実施していません。
独自ドメインの旧サーバー用SSL・HTTPS確認とDNS切り替えは別工程で、
DNS切り替えは利用者の別途指示を受ける最後の工程として保留しています。

## Secretと新サーバー

行政書士PASSリポジトリの `XSERVER_XS968799_FTP_PASSWORD` は登録・認証済みで、
両サイトともこの旧サーバー専用Secretだけを使用しました。
同じ処理で両サイトを配置するため、司法書士PASS側へのパスワード重複登録は不要です。
新サーバー用の `XSERVER_FTP_PASSWORD` は使用・上書き・削除していません。
新サーバー向け `migrate-xs366651.yml` は `disabled_manually` のままです。

## 司法書士PASSアプリ側の差し戻し

下書きPR #1 は維持し、審査用APIのendpoint・issuer、Androidの時刻取得先と
設置・接続・ビルド検証を `https://xs968799.xsrv.jp/pass-review` に揃え済みです。
Nodeテスト32件、PHP統合テスト11件、両Webビルド・UI検証・両AndroidデバッグAPKビルドは成功済みです。
この静的サイト配置作業では下書きPRのマージやアプリの新規配布は行っていません。

- 下書きPR: https://github.com/lifes20220721/shihoshoshi-pass/pull/1
- アプリの検証: https://github.com/lifes20220721/shihoshoshi-pass/actions/runs/44866821745
