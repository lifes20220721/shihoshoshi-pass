# 司法書士PASS

全11科目のテキスト、○×2,033問、５肢択一385問、公式過去問360問、判例ノートを収録する静的学習サイトです。

公開URL：<https://shihoshoshipass.com/>
関連サイト：[行政書士PASS](https://gyoseishoshipass.com/)

## Ver.2.0.0 の構成

行政書士PASSと同様に、HTML・CSS・JavaScript・教材データを分離しています。実行にサーバー側プログラムやフレームワークのビルドは必要ありません。GitHub Pagesでそのまま配信できます。

| ファイル | 編集する内容 |
| --- | --- |
| `index.html` | 画面の枠、メニュー、公開情報、AdSense認証タグ |
| `styles.css` | スマートフォン・PCの画面デザイン |
| `app.js` | 基本の出題・採点・画面切替 |
| `js/storage.js` | 既存の学習履歴の読込・保存 |
| `js/subjects.js` | 科目・分野の選択、５肢択一、科目別成績 |
| `js/study-tools.js` | 復習、模擬試験、学習計画、バックアップ |
| `js/resume.js` | ホーム・科目・分野・形式ごとの途中位置 |
| `js/library.js`, `js/learning.js` | テキスト表示、問題と教材の連携 |
| `js/past-exams.js`, `js/casebook.js` | 過去問・判例ノートの表示 |
| `js/article-links.js` | 参照条文からe-Gov原文へのリンク |
| `js/question-quality.js` | 頻出補強問題の登録と解説表示 |
| `js/pwa.js`, `service-worker.js` | ホーム画面への追加・オフライン利用 |

### 教材データ

- `data/questions/{科目ID}.js`：11科目別の増補問題。`civil`＝民法、`realestate`＝不動産登記法、`company`＝商法・会社法、`commercialreg`＝商業登記法、`civilprocedure`＝民事訴訟法、`execution`＝民事執行法、`preservation`＝民事保全法、`constitution`＝憲法、`criminal`＝刑法、`deposit`＝供託法、`scrivener`＝司法書士法。
- `data.js`：問題IDによる読込順の一覧。既存の保存位置を守るため、配列順を維持して科目別問題を組み立てます。
- `data/base.js`：初期教材・初期問題。既存の５肢択一の番号を維持するための元データです。
- `data/subjects.js`, `data/lesson-notes.js`, `data/lessons.js`：科目構成、入門ノート、分野別テキスト。
- `data/past-exams.js`：公式過去問・解説と法改正情報。５肢択一の過去問もここから組み立てます。
- `data/cases.js`：判例ノート。
- `data/reinforcement.js`：頻出分野の補強問題。

すべての教材を読み込んだ後に学習機能を起動します。`scripts/assets.json` と `index.html` の `defer` 付きスクリプト順を揃えてください。既存の画面イベントとの互換性のため、classic scriptと既存の関数名を維持しています。

## 編集・確認・公開

1. 対象のデータまたは機能ファイルを編集します。HTMLへのコード埋込みは不要です。
2. `npm run prepare:release` で内容に応じたアセットURLとオフラインキャッシュを更新します。
3. `npm test` を実行します。依存ライブラリのインストールは不要です（Node.js 18以上）。
4. `python3 -m http.server 8000` を実行し、`http://localhost:8000/` で確認します。
5. 変更したファイルと更新後の `index.html`・`service-worker.js` をGitHubへ反映します。

実ブラウザテスト：PlaywrightとChromiumを用意し、`npm run test:browser` を実行します。必要なら `CHROMIUM_PATH` でChromiumの場所を指定します。旧版の完全な公開ファイルを用意できる場合は、`BASELINE_ROOT=/path/to/v1.9.2 npm run test:browser` で実際の更新・履歴移行も確認できます。

`service-worker.js` は生成物です。キャッシュ方針は `scripts/service-worker.template.js` で編集します。新しいキャッシュは全教材の保存成功後に有効になり、旧キャッシュを置き換えます。

### 問題を追加・修正する際の注意

- 既存の問題ID、科目ID、分野IDを変更しないでください。
- ５肢択一の履歴は既存の配列番号を参照します。既存問題の並べ替え・削除は移行処理なしに行わないでください。
- 科目別増補問題を追加する場合は `data.js` のID一覧にも追記します。
- 問題数の検査は `js/learning.js` と `js/question-quality.js` にあります。教材追加時は意図した件数へ更新してください。
- `tests/content-baseline.json` はv1.9.2との全文一致を検証する記録です。意図した教材変更では変更対象をレビューし、この基準も更新してください。

## 保存データの互換性

以下のlocalStorageキーを維持しています。移行時に履歴を削除・初期化しません。

- `shihoshoshi-pass-v03`：解答履歴・復習対象
- `shihoshoshi-pass-v13-settings`, `shihoshoshi-pass-v13-exams`：設定・模擬試験結果
- `shihoshoshi-pass-progress-v1`：ホームからの再開
- `shihoshoshi-pass-scoped-progress-v1`：形式・科目・分野・出題範囲別の再開

記録は同じ公開URL・同じ端末・同じブラウザ内に保存されます。端末間の同期はありません。既存のバックアップ形式も変更していません。

## 旧版ファイル

`build-v*.py`、`index-v*-*.html`、`shihoshoshi-pass-v*.html`、旧版の単独JS・JSONは履歴資料として残しています。**Ver.2以降の編集・公開に旧ビルドスクリプトを使わないでください。** 現行のソースは上表のファイルです。旧版HTMLはGitHubの言語集計で生成済みアーカイブとして扱います。

移行内容と検証結果は `refactor-audit-v2.0.0.md` を参照してください。
