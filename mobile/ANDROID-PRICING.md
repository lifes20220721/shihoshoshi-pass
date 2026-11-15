# 司法書士PASS Androidの販売価格

利用者の指定：月額500円、年額5,000円。対象は司法書士PASSのAndroid版、日本での円建て表示価格。行政書士PASSとiOSの価格は本決定の対象外。

| プラン | 更新期間 | 日本での表示価格 |
|---|---|---:|
| 月額 | 1か月・自動更新 | 500円 |
| 年額 | 1年・自動更新 | 5,000円 |

年額は月額を12か月利用した6,000円と比べて1,000円少ない。アプリの無料ダウンロードと各科目の無料サンプルは維持する。

## 現在の確認済み状態

利用者が両プランの有効化と内部購入テストに明示的に「はい」と承認し、Google Play内AIの状態変更を適用した。run43768894075/job132980111464で、monthly/annualともACTIVE、日本のみ、JPY500/P1M・JPY5000/P1Yと読み戻した。DRAFT保存時との比較で状態以外の基本プラン設定が同一であることも確認。次は本人のGoogleアカウントで内部テストへ参加し、Google Playから通常パッケージ版2をインストールして実購入・復元を検証する。購入テスト完了、一般公開、製品版の審査提出とは扱わない。

以下は下書き保存までの経緯。

Google Playへ月額・年額の基本プランを保存し、RevenueCatのlive store_stateで読み戻した。run43719122801/job132827052573で、両商品がstatus ok、日本のみ、月額JPY500/P1M、年額JPY5000/P1Y、両方DRAFTであることを確認した。月額の猶予期間・下位互換性など既存設定も変更されていない。

月額は所有者が画面で保存。年額はGoogle Play公式の「AIで管理」で差分を準備し、所有者がDraft/Auto-renewing/1 year/JPY5000の差分を確認して適用した。外部APIの編集はHTTP403のため継続しない。定期購入そのものや無料試用・割引を重複作成していない。価格の自動換算や海外・将来地域の販売は追加していない。

未完了：両プランの有効化と実購入・取消し・復元・期限切れテスト。有効化については保存とは別に利用者へ確認する。RevenueCatカタログ、Google資格情報のValid credentials、署名済み通常パッケージ版2の本人1人への内部配信は確認済み。

本人の公開用Googleアカウントlife.s.20220721@gmail.comは、Google公式資料上、自動的にライセンステスターとして扱われる。内部テスターと同じメールを使う前提なので、追加のライセンステスター登録を推測で要求しない。実購入確認では端末のアカウントとGoogle購入画面のテスト注文表示を確認する。公式資料：https://support.google.com/googleplay/android-developer/answer/6062777

版2のファイルと検証結果は [ANDROID-INTERNAL-TEST.md](ANDROID-INTERNAL-TEST.md) を参照。一般公開と製品版の審査提出は未実施。

## 初期設定時の経緯（上記の現在の状態を優先）

初回AABはPlay Consoleに受理され、下書き保存とAPIでの登録済みファイル照合を確認した。画像1000001435およびGitHub run 43602824821のAPI読み取りで、商品ID `shihoshoshi_premium`、表示名「司法書士PASS 全機能プラン」、基本プランが空であることを確認した。自動追加処理run 43602945022は価格地域バージョン取得時のHTTP403で停止し、基本プラン・価格は未変更。司法書士PASSに限った「ストアでの表示の管理」権限の追加が必要。

利用者が作成した商品IDを再利用し、別の商品は作成しない。既存購読者の価格変更・移行は行わない。

利用者の追加権限保存後、read-only browser run a24b8a5f-3394-47dd-9c8f-9f9628c3b6dbで、自動処理用ユーザーが有効・期限なし、司法書士PASS（com.shihoshoshipass.app）の閲覧・テストリリース・ストアでの表示の管理の3権限を持つことを確認した。通常IDに対するcatalog PATCHはrun 43604073032（attempt2、2026-11-14T14:21:32Z）でもHTTP403 PERMISSION_DENIEDとなった。基本プラン・価格の保存は未完了で、権限反映待ちの可能性がある。追加の財務・注文・本番公開・管理者権限は要求しない。無人の定期再試行は設定していない。RevenueCatアカウントの有無は利用者も不明で、ログイン確認が次の独立した手順となる。

- Play Console：月次の基本プランをJPY 500、年次をJPY 5,000に設定する。日本で購入者に表示される最終価格と更新期間を確認する。その他の国・通貨は未決定。
- RevenueCat：既存のアプリID `com.shihoshoshipass.app`、entitlement `shihoshoshi_premium`、offering `shihoshoshi_subscription` を維持する。月額・年額の商品を同じentitlementへ関連付け、offeringのMONTHLY・ANNUAL packageへ対応付ける。
- ローカルアプリ設定：Android用の公開SDKキーが未設定。秘密のサービスアカウント鍵はRevenueCatの安全な設定画面で扱い、アプリやチャットへ入れない。
- 更新：RevenueCatの実プロジェクトへGoogle Play用の2商品・package・offering・entitlement紐付けをAPIで保存し、読み戻し確認に成功した。Android production公開SDKキーをapps.jsonとローカルWebビルドへ反映済み。Google購入確認用サービス資格情報、Google Playの価格保存、正式AABと購入テストは未完了。詳細はautomation/REVENUECAT-CONNECTION.md。
- アプリ内価格は引き続きストアSDKの `priceString` を表示する。今回の決定値を架空の購入可能価格としてハードコードしない。

商品・基本プラン・価格が管理画面で保存され、RevenueCatから取得できたことを確認するまで、商品設定完了や購入テスト済みのチェックは付けない。正式な提出用ビルドで、月額500円・年額5,000円の表示、購入、取消し、復元、期限切れ、審査用アクセスを検証する。提出・公開・リリースは未実施。
