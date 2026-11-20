# PASS ストアアプリ準備版

2026-11-20：司法書士PASSの次回ビルド用の接続先をxs366651へ変更。[サーバー移行の現在の状態](XSERVER-MIGRATION.md)を優先してください。新ホストのSSL・データ移行・実通信とアプリ配信は未完了。以下の旧設置記録にあるclient-public.deployed.jsonをそのまま戻さず、次回ビルドではreview-access.public.jsonを使用します。

## 審査用認証の実装とXServerへの設置

司法書士PASS向けに、サーバーで認証した専用アカウントへ短時間の署名付き学習権限を発行する仕組みを追加しました。固定解除パスワードや購入状態の上書きは使いません。2026-11-13にXServerへの設置と実通信の認証確認を完了。手元のアプリ設定へ公開鍵とURLを反映しました。Android実機の確認は未実施です。通常の課金設定と学習データは維持しています。

実装・検証の詳細は [REVIEW-ACCESS.md](REVIEW-ACCESS.md)、Play Console向けの英語手順は [PLAY-REVIEW-INSTRUCTIONS.en.md](PLAY-REVIEW-INSTRUCTIONS.en.md)。Androidアプリのアップロード・審査送信・公開・リリースは行っていません。

PHP版を既存のXServerへ設置しました。構成・確認結果・残作業は [DEPLOYMENT-XSERVER.md](DEPLOYMENT-XSERVER.md)。Render案は予備として [DEPLOYMENT-RENDER.md](DEPLOYMENT-RENDER.md) に残し、契約・配備は行っていません。

利用者が接続ファイルを1回アップロードした後、署名付きHTTPS要求による初回設置・実ログイン・接続ファイル削除を自動実行しました。詳細は [AUTOMATION-XSERVER.md](AUTOMATION-XSERVER.md)。APIキー・SSH鍵の登録は不要でした。設置済み公開鍵は `xserver-php/client-public.deployed.json`。ソースZIPから再構築する場合は、この内容をローカル設定の `shihoshoshi.reviewAccess` へ追記し、既存の課金設定を保持します。

通常版と別にインストールできる確認用APKも作成し、署名・アプリID・教材一致・秘密情報の非同梱を検証しました。実機での確認方法は [ANDROID-REVIEW-TEST.md](ANDROID-REVIEW-TEST.md)。Android端末の操作確認と実決済は未実施です。

司法書士PASS・行政書士PASSを、無料体験＋月額／年額の購読で利用するAndroid・iOSアプリのソースです。既存のWebサイトを変更せず、教材をアプリ内へ収録します。

## 現在できていること

- 司法書士11科目・行政書士6科目の○×問題を、各科目10問まで無料体験。途中位置は端末に保存。
- 有効な購読をRevenueCat SDKから確認した場合、既存の全学習画面を表示。
- Apple StoreKit／Google Play Billingを利用する月額・年額購入、購入復元、更新・解約画面への移動。
- ローカルの学習通知、学習記録のファイル保存・共有・復元、削除。
- 購入情報の未取得、取消し、承認待ち、期限切れは有料機能を開かない。
- SDKキー未設定時は無料体験だけ動作し、架空の価格や購入成功を表示しない。

## 未完了のこと

**ストアへの申請・販売はまだ行っていません。** 商品・価格・本番署名・RevenueCat連携の設定と、実ストアのSandbox決済、端末での通知・共有、提出用AAB／IPAの検証が必要です。確認用APKのビルド・署名検証は完了しています。iOSネイティブコンパイルにはMacとXcodeが必要です。アプリ審査の承認は各ストアが判断します。

## 開発

Node.js 22以上、npm、curl、tarを用意します。

```sh
npm ci
node scripts/fetch-sources.mjs
npm run build
npm test
npm run native -- shihoshoshi android
npm run native -- shihoshoshi ios
npm run native -- gyoseishoshi android
npm run native -- gyoseishoshi ios
```

教材の取得先は `apps.json` のコミットに固定しています。生成物は `dist/{資格名}`、ネイティブプロジェクトは `native/{資格名}/android` と `native/{資格名}/ios` に作ります。生成物・取得した教材・署名鍵はGitに登録しません。ソースを更新する場合は固定コミット、無料サンプルの抽出処理、教材の動作を再確認してください。

Android Studioで `native/{資格名}/android`、Xcodeで `native/{資格名}/ios/App/App.xcodeproj` を開きます。生成処理はブランドアイコン、通知アイコン、課金時の画面復帰設定、iOSのPrivacy Manifestも配置します。

`npm run test:browser` はPlaywrightとChromiumがある開発環境で実行できます。ブラウザテストはストアSDKの実決済を代替しません。

## 販売設定

`store-config.example.json` を `store-config.local.json` へコピーし、各アプリのRevenueCat公開SDKキーを設定します。App Store Connectの秘密鍵、Googleのサービスアカウント秘密鍵、署名鍵はこのファイルやGitに入れず、各サービスの安全な設定画面で管理してください。

`apps.json` のBundle IDは登録前の案です。アカウント内で利用可能か確認し、正式登録前に確定してください。プラン名、Entitlement、Offering、月額・年額商品の対応は [STORE-SETUP.md](STORE-SETUP.md) に記載しています。料金はSDKが返すストアの現地通貨表記を表示します。価格はまだ決めていません。

設定・実機検証を終えた後に `npm run check:release` を実行してください。確認項目をtrueにするだけで審査準備が完了するわけではありません。各項目の作業記録を残してください。

## 記録と購入の扱い

Webブラウザの学習履歴はアプリへ自動転送されません。有料の学習画面内にある従来のバックアップ機能からWeb版のバックアップを取り込めます。新しいアプリ専用バックアップは、アプリ内の無料体験・従来の学習データをまとめて保存します。購読状態はバックアップに含めず、ストアから復元します。

通常ユーザー用のアプリ内ログインは設けていません。設定により司法書士PASS Androidの審査担当者専用ログインを有効化できます。購入の復元は同じOSの同じストアアカウントで行います。iOS／Android間・司法書士／行政書士アプリ間の購読共有は提供しません。

## 検証記録

購入状態・取消し・承認待ち・復元・期限切れ・バックアップ検証のユニットテストに成功。両ブランドの無料体験、再読み込み後の再開、購読未設定時の画面、教材画面をChromiumで確認しました。Android・iOSの4プロジェクトの生成に成功しました。ネイティブの実機検証と署名付き配布物のビルドは未完了です。
