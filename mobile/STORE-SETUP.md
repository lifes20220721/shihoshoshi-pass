# ストア登録から販売開始まで

決定済み：資格別の2アプリ、基本無料、各科目○×10問の無料体験、月額・年額購読で当該アプリの全学習機能を解放。価格はストアで設定する。無料問題を使うだけでは購読は開始しない。

## 1. ご本人が開発者アカウントへ登録する

- Apple Developer Program：<https://developer.apple.com/programs/enroll/>。標準料金は年99米ドル相当、地域・登録画面の表示に従う。
- Google Play Console：<https://play.google.com/console/signup>。標準登録料は1回25米ドル。
- 本人確認、契約への同意、支払い、販売代金の受取口座・税務情報はご本人が登録する。パスワード・本人確認書類・秘密鍵をチャットへ送らない。
- Googleの新しい個人アカウントは、対象となる場合、12人以上が14日連続で参加するクローズドテストと本番アクセス申請が必要：<https://support.google.com/googleplay/android-developer/answer/14151465>。

## 2. アプリと商品を登録する

| アプリ | Bundle ID案 | RevenueCat entitlement | RevenueCat offering |
|---|---|---|---|
| 司法書士PASS | com.shihoshoshipass.app | shihoshoshi_premium | shihoshoshi_subscription |
| 行政書士PASS | com.gyoseishoshipass.app | gyoseishoshi_premium | gyoseishoshi_subscription |

App Store ConnectとPlay Consoleで各アプリを無料アプリとして作成し、アプリ内に月額・年額の自動更新購読を登録する。Appleでは同じ資格の月額・年額を同じ購読グループに入れる。Googleでは資格ごとの購読に月次・年次の基本プランを用意する。

価格、販売地域、更新条件、サポート連絡先を確定する。アプリ内価格はストアの設定から取得する。購読の無料試用オファーは現在実装に依存させていないため、まず通常の月額・年額商品で検証する。

## 3. RevenueCatを接続する

<https://www.revenuecat.com/docs/getting-started/installation/capacitor>

各アプリのApple／Google設定・商品をRevenueCatに登録する。月額・年額の両商品を当該entitlementに紐付け、offeringにはMONTHLYとANNUALのpackageを登録する。各プラットフォームの**公開SDKキー**をローカル設定へ入れる。RevenueCatは別サービスなので、料金体系とデータ処理条件を登録時に確認する。

匿名利用者IDを使う構成。ストア購入を確認して有料画面を開く。学習履歴はRevenueCatへ送信しない。ストア連携用の秘密鍵をアプリへ埋め込まない。

## 4. 申請資料を確定する

アプリ名・説明文・アイコン・スクリーンショット・サポートURL・アプリ版専用のプライバシーポリシーURL・利用規約URLを揃える。既存Web版のプライバシーポリシーは、アプリ版の購入処理を説明していないため、そのまま流用しない。

アプリ内のプライバシー／利用規約は下書き。正式な販売者情報、購入処理を行うRevenueCat／Apple／Google、バックアップの共有、データ削除手順を確認し、公開URLを用意する。App Privacy／Data safetyでは購入履歴・匿名IDなどSDKが処理する項目も確認する。AppleのPrivacy Manifestとストア上の申告は別の作業。

教材の出典と商用配信の条件を確認する。App Storeの最低機能要件に向けてオフライン学習、問題演習、履歴、通知、共有を用意しているが、承認は保証されない：<https://developer.apple.com/app-store/review/guidelines/#minimum-functionality>。

## 5. テストして提出する

1. Android Studio／Xcodeで端末にインストールし、課金前の無料体験、購入、取消し、承認待ち、更新、期限切れ、復元をSandbox／ライセンステスターで確認。
2. 機内モード、再起動、通知拒否、共有の取消し、バックアップ復元、履歴削除を確認。
3. 月額から年額への変更、解約後の有効期限、購入したストアアカウントでの再インストールを確認。
4. TestFlight／Googleクローズドテストで確認。Googleで必要な12人・14日要件を満たす。
5. Androidの署名用鍵とiOSの署名設定を確定し、AABと署名済みアーカイブを作成。秘密鍵は保存・共有先を限定する。
6. `npm run check:release` の未完了項目を解消し、ストアの審査へ提出する。

審査メモ例：各科目の無料問題はログインなしで利用可能。購読画面から月額・年額を選択し、購入後に全機能へ進む。「購入を復元する」は同画面。通知とバックアップはホームの設定。外部資料のリンク以外の教材は端末内に収録。
