# GitHub Pages（ガワ）+ Gist（データ）構成

## 前提と結論

- 使うのは自分だけ。
- 置くデータは基本的に公開情報。個人に直接結びつく情報は置かない。位置情報など、自分との関係が少し分かる程度の情報が入ることはある。
- 守りの強さは**限定公開程度**で足りる。権限で隠す必要はない。

→ **GitHub Pages + Secret Gist の構成で実現できる。** 新しいインフラも、暗号化も要らない。

---

## 1. 構成

```
[GitHub Pages]  app.html（表示用の HTML と JS だけ。データは持たない）
      │
      │  ブラウザで https://<user>.github.io/<repo>/app.html#id=<GistID> を開く
      ▼
[ブラウザ]  #id を読む ── fetch ──▶ https://api.github.com/gists/<GistID>
      │                                   │
      │◀──────────── JSON（files.data.json.content）
      ▼
  持ち主を確かめる → JSON を parse → textContent で描画
```

| 要素 | 役割 |
|---|---|
| GitHub Pages | `app.html` だけを置く。リポジトリにデータは入れない |
| Secret Gist | データ本体。ファイル名は `data.json` に固定する |
| URL のハッシュ `#id=` | 表示する Gist を選ぶ。サーバーには送られない |

## 2. 前提になる仕様（成り立つことを確認済み）

| 項目 | 状況 |
|---|---|
| ブラウザから `api.github.com/gists/{id}` を fetch | 可能。GitHub REST API はどのオリジンからの CORS も受ける |
| 認証なしで Secret Gist を取得 | 可能 |
| `#id=...` | フラグメントはサーバーに送られないので、Pages のアクセスログや Referer には残らない |
| レート制限 | 認証なしの API は IP ごとに 60 回/時。使うのは自分だけなので足りる |

## 3. 限定公開で受け入れる範囲

Secret Gist は private ではない。次のことを承知したうえで使う。

- URL（Gist ID）を知っていれば、誰でも中身を見られる。ID は 32 桁の 16 進数なので、推測で見つかることはない。
- ID が分かれば、`gist.github.com/<ID>` から次のものが見える。
  - **Gist の持ち主の GitHub アカウント名**
  - **過去の版（revisions）すべて**
- 中身を書き換えても古い版は残る。消したいときは、Gist ごと削除する。

### 位置情報について

- 置く位置情報は**エリア程度の粒度**で、住所や行動が分かるものではない。持ち主のアカウント名と並んで見えても、関係するエリアが分かる程度なので、この構成で問題ない。
- アカウントを分けるなどの対策は要らない。
- 守ること: 住所・特定の地点・日時つきの移動の記録など、**エリアより細かい情報は置かない**。置いてしまった場合、版の履歴にも残るので、Gist を作り直す。

## 4. 実装の方針（提示のサンプルからの変更点）

| 変更点 | 理由 |
|---|---|
| 表示に `innerHTML` を使わず、`textContent` を使う | サンプルは JSON の値をエスケープせずに `innerHTML` へ入れており、XSS が起きる。ID は URL で外から指定できるので、他人の Gist を読み込まされるとスクリプトが動く。`<user>.github.io` 配下のページはすべて同じオリジンなので、ほかのリポジトリのページにも影響する |
| `gistData.owner.login` が自分のアカウントか確かめ、違えば表示しない | 他人の Gist を表示しないため |
| ファイル名を `data.json` に固定し、`files['data.json']` で取る | `Object.keys(files)[0]` は、ファイルが複数あると意図したものを選ぶとは限らない |
| `truncated` が真なら `raw_url` から取り直す | API の `content` は 1 ファイル 1MB で切り詰められる |
| `hashchange` で再描画する | 同じタブで `#id` を変えたときに表示を切り替えるため |
| CSP の meta を入れる（`script-src 'self'` と、`connect-src https://api.github.com https://gist.githubusercontent.com`） | 万一の XSS を抑えるため。インライン script をやめて、JS は別ファイルにする |

### ファイル構成

```
<repo>/
├── app.html   # 表示枠と CSP
└── app.js     # ハッシュの読み取り → 取得 → 確認 → 描画
```

### 処理の流れ（app.js）

1. `location.hash` から `id` を取る。なければエラーを表示する
2. `fetch('https://api.github.com/gists/' + id)`
3. `owner.login` を確かめる
4. `files['data.json']` を取り出す。`truncated` なら `raw_url` から取り直す
5. `JSON.parse` して、要素を作り `textContent` で描画する

## 5. データの作成と更新

- 作成: `gh gist create data.json`（オプションを付けなければ Secret Gist になる）→ 出てきた ID を URL の `#id=` に入れる
- 更新: `gh gist edit <ID> data.json`（古い版は履歴に残る）
- 削除: `gh gist delete <ID>`

## 6. 将来、要件が変わったとき

| 変わったこと | 対応 |
|---|---|
| 中身を GitHub 側にも見せたくなった | Gist には暗号文を置き、鍵を URL の `#k=` に入れて WebCrypto で復号する。インフラはそのまま |
| ほかの人と共有したくなり、人ごとに許可・取り消しをしたい | Cloudflare Pages + Cloudflare Access などに移す（GitHub Pages + Gist ではできない） |
| 閲覧が増えてレート制限に当たる | raw URL（`gist.githubusercontent.com`）から直接取る（CORS の可否は要確認） |
