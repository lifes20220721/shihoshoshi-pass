# 両PASSサイトのサーバー移行（2026年11月20日）

移行先は行政書士PASSと共通の **xs366651（プレミアム）** です。
接続先は `sv17351.xserver.jp`、確認したIPv4は `85.131.200.112` です。

- 司法書士PASSの公開URLは https://shihoshoshipass.com/ を維持します。
- 行政書士PASSの公開URLは https://gyoseishoshipass.com/ を維持します。
- 各ドメインの `public_html/` へ、それぞれの公開ファイルを配置します。
- 配置先・バックアップ・両サイトのファイル照合を一括処理し、両サイトのHTTPS確認後にDNS切り替えへ進めます。
- 移行準備時点の司法書士PASSは `91db70d8218a1cd7464a9d7f4909b42a490e4131` です。その後に公開ファイルが更新されていれば、古いファイルを転送せず停止します。
- 既存のドメイン、localStorageキー、アプリ用プライバシーページを維持します。
- 行政書士PASSの購入確認は既存Cloudflare Workerを継続使用します。
- SSH鍵、FTPパスワード、Google秘密鍵は公開ファイルに含めません。

一括ワークフロー:
https://github.com/lifes20220721/gyoseishoshi-pass/actions/workflows/migrate-xs366651.yml

詳細:
https://github.com/lifes20220721/gyoseishoshi-pass/blob/xserver-xs366651/hosting/xserver/README.md

現時点では実転送とDNS切り替えは未完了です。接続情報の登録・配置先の確認後に一括処理を実行します。
この資料の作成だけをもって移行済みとは扱いません。
