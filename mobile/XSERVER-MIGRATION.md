# xs968799からxs366651への接続先変更

利用者の明示指示により、司法書士PASSの次回ビルドの接続先を `https://xs366651.xsrv.jp/pass-review` へ変更した。endpoint、署名検証のissuer、時刻確認用Androidプラグイン、設置・接続確認・ビルド検証スクリプトの対象を更新した。

課金設定と公開鍵は維持した。旧サーバーと配信済みAABは変更していない。サーバー移行、新しい署名済みアプリの作成・配信は未完了。

## 必要な情報と作業

1. 新初期ドメイン `xs366651.xsrv.jp` のSSL有効化・反映完了。利用者の画像ではSSLが×だったため、現在のSSL設定画面またはHTTPS疎通確認が必要。
2. 旧サーバーの `xs968799.xsrv.jp/public_html/pass-review/` と `xs968799.xsrv.jp/pass-review-private/` を取得し、新サーバーへ配置できる接続手段。
3. private側の署名鍵、アカウント、設定、PHPサービスとSQLite状態の整合したバックアップ。秘密情報をチャットや公開フォルダに置かない。

新配置先は `xs366651.xsrv.jp/public_html/pass-review/` と、その公開領域の外の `xs366651.xsrv.jp/pass-review-private/`。署名鍵と審査アカウントのハッシュを保持し、server.jsonのissuerとclient-public.jsonのendpoint/issuerを新URLへ更新する。SQLiteは動作中の単純コピーを避ける。初回設置スクリプトによる新鍵・新アカウントの作成を、既存データの移行の代わりに実行しない。

HTTPS証明書、healthz、既存アカウントのログイン・grant・logout、秘密ファイルの非公開を確認してから実機確認する。紹介特典の時刻取得も新ホストで確認する。

`review-access.public.json` は次回ビルド用。`xserver-php/client-public.deployed.json` と `XSERVER-LIVE-RESULT.json` は旧サーバーでの実測記録であり、書き換えて移行済み扱いにしない。旧サーバー向けの既存AABを新対応版として再配布しない。
