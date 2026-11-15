# 司法書士PASS Android 内部テスト版2

準備用の版1にはなかった本番用の公開RevenueCat SDK設定と、実機で確認済みの審査用ログインのクライアントを含む内部テスト候補。版2は、本人1人を対象とする内部テストへ、利用者の明示承認後に配信済み。商品有効化、購入テスト、一般公開、製品版の審査提出はまだ行っていない。

| 項目 | 確認値 |
|---|---|
| パッケージ | com.shihoshoshipass.app |
| versionCode / versionName | 2 / 1.1.0-internal |
| 署名済みAAB | shihoshoshi-pass-internal-v2.aab |
| サイズ | 7,222,263 bytes |
| SHA256 | 1dc107e8b44819393f636b58ab1d943dee45a0e6ac28d282fa351cd174ebb59b |
| アプリソース | 9d913b697fdb196134ddaf0de68799891ee32395 |
| CIビルド | https://github.com/lifes20220721/shihoshoshi-pass/actions/runs/43684561953 |
| Drive | https://drive.google.com/file/d/1kzRi26ejY7tr9Pg-_H_K11Lp5HXhnGij/view?usp=drivesdk |

Driveは所有者と既存アップロード用サービスアカウントのreaderのみ。公開共有・ドメイン共有なし。従来と同じアップロード証明書で署名し、署名を検証した。秘密鍵、Googleサービスアカウント鍵、RevenueCat秘密キー、審査用パスワードはAABに含めていない。全45ファイルのWebアセットとCI出力の一致を確認した。

## 検証

- ローカルの既存Nodeテスト、Webビルド、審査ログインの実際のUI制御テストが成功。
- CIでもNodeテストとUI制御テスト、Android bundleReleaseが成功。
- 審査用ログインは実サーバー向けの公開設定だけを同梱。認証情報やセッションは配布ファイルに保存しない。
- keylessアップロード処理は計66テストが成功。版1の既知の署名済みファイルを使う未公開の内部下書きだけを版2へ置換でき、別ファイル・公開済みリリースは拒否する。
- この通常パッケージの版2での実機確認、購入・復元はこれから。別パッケージreviewtestの確認結果と混同しない。

## Google Playの現在の状態

初回は版1（1.0）の未公開リリースだった。内部テスターのリスト「司法書士PASS 内部テスト」に本人1人を登録し、トラックで選択して保存済み。

版2の自動保存はrun43686849598/job132729050167でedits:commitがHTTP400 INVALID_ARGUMENTになり、確定できなかった。一時editの削除処理を実行し、配信・審査は開始していない。自動処理はconnectionへ戻した。エラー本文の原因は未確定で、changesNotSentForReviewを外す自動再試行は実装していない。GoogleのcommitはConsoleでの保留変更にも影響しうるため、手動の下書き保存へ切り替える。

その後、ユーザーが版2を手動アップロードし、版1をこの下書きから除外、リリース名を「司法書士PASS 内部テスト v2」として保存。本人1人への内部テスト配信に対して明示的に「はい」と承認を得た後、ユーザーが「保存して公開」を実行した。最新画面で内部トラック「有効」、最新リリース名の一致を確認。一時名com.shihoshoshipass.app (unreviewed)が表示されている。次はRevenueCatの資格情報再検証とテスト用インストール。

## 商品と認証の未完了事項

Google Playの既存商品shihoshoshi_premiumはあるが、月額500円・年額5,000円の基本プランは未保存。RevenueCat側のカタログ・entitlement・offeringの関連付けは保存済み。Google鍵もRevenueCatへ登録済み。

RevenueCat画面では商品カタログと購読カタログの読み取りが成功し、購入確認だけ「Google Play package name was not found」。パッケージ名、Googleプロジェクト、購入確認用メール、鍵ID先頭は一致。Google Playの初期設定・テストリリース状態を確認中。内部配信後のrun43699415993/job132767039003でも、商品編集プランには別途権限blockerが2件あり、applyはしていない。購入確認の資格情報はRevenueCat画面で改めて再検証する。

価格のハードコードや審査ログインによる課金状態の偽装は行わない。価格はストアSDKの実値を表示する。実購入テスト前にライセンステスター設定も確認する。
