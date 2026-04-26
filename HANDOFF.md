# 引き継ぎノート（kazaana × thebecos / Hydrogen + Oxygen）

このドキュメントは、ある作業セッションから別セッションへ作業を引き継ぐためのスナップショットです。**コードや仕様は git log と CLAUDE.md が一次ソース**で、本書は「いま何が起きていて何が宙ぶらりんか」を伝えるための補助資料です。

最終更新: 2026-04-26（PR #11 マージ完了時点 / PR #12 オープン中）

## 1. このプロジェクトは何

- thebecos.com（伝統工芸品の Shopify ストア）の商品を **30%OFF** で再表示する会員サイト
- Shopify Hydrogen（Remix ベース）+ Oxygen（Shopify CDN）構成
- 価格は `app/lib/pricing.ts` の `DEFAULT_DISCOUNT = 0.7` で一律割引、`PRICE_OVERRIDES` で個別上書き可
- レポジトリ: <https://github.com/kazaana-memoco-team/kazaana-memoco-team-repository>
- 本番 URL（OAuth 保護下のステージング扱い）:
  <https://xn--becos-b0ec320ffe10bebbf598-yr75b2z1c5vr.o2.myshopify.dev/>

## 2. 主要ファイル早見表

| パス | 役割 |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | チームルール・運用方針（pull → feature → PR → auto-merge → Oxygen） |
| [app/lib/pricing.ts](app/lib/pricing.ts) | 価格変換ロジック（×0.7 / overrides） |
| [app/components/ProductPrice.tsx](app/components/ProductPrice.tsx) | 割引価格 + 取消線 + 30%OFF バッジ表示 |
| [app/components/ProductItem.tsx](app/components/ProductItem.tsx) | 商品カード（一覧用） |
| [app/components/Header.tsx](app/components/Header.tsx) | 黒基調ヘッダー、kazaana × thebecos ブランド |
| [app/components/Footer.tsx](app/components/Footer.tsx) | 黒基調フッター、thebecos.com への外部リンク |
| [app/components/BottomNav.tsx](app/components/BottomNav.tsx) | モバイル用ボトムナビ（5 タブ、`max-width: 47.99em` のみ表示） |
| [app/routes/_index.tsx](app/routes/_index.tsx) | トップ（こんにちは！ヒーロー + カテゴリから探す + おすすめ商品） |
| [app/routes/collections._index.tsx](app/routes/collections._index.tsx) | カテゴリ一覧 |
| [app/routes/collections.$handle.tsx](app/routes/collections.$handle.tsx) | 個別カテゴリ |
| [app/routes/products.$handle.tsx](app/routes/products.$handle.tsx) | 商品詳細 |
| [app/styles/app.css](app/styles/app.css) | サイト全体スタイル（カードサイズ統一・モバイル対応含む） |
| `.github/workflows/oxygen-deployment-1000131506.yml` | Shopify が自動セットアップした Oxygen デプロイ workflow |
| [vercel.json](vercel.json) | Vercel ビルドを no-op success にする設定（用途は #5 参照） |

## 3. 自動デプロイ

- main へのマージ → `Storefront 1000131506` workflow が走り Oxygen へ自動デプロイ
- 必要 Secret: `OXYGEN_DEPLOYMENT_TOKEN_1000131506`（Shopify Hydrogen channel が GitHub Secrets に自動登録）
- ローカルからのデプロイは `npx shopify hydrogen deploy --env production` だが対話入力を要求するので CI 経由が標準

## 4. ローカル開発の最低限

```bash
git pull origin main
npm install                 # ※ pnpm ではなく npm（package.json の workspace:* / catalog: は具体バージョンに置換済）
npx shopify hydrogen link --storefront "会員制BECOS"  # 初回のみ
npm run dev                 # http://localhost:3001/
```

`.env` には現状 `SESSION_SECRET="foobar"` だけ。Storefront API トークン等は `shopify hydrogen link` 後にローカル CLI が Oxygen から動的注入してくれる仕組み（dev サーバー起動時に `from Oxygen` と表示される）。

## 5. これまでにマージ済の PR（時系列）

| # | 内容 | リンク |
| --- | --- | --- |
| #1 | PR + auto-merge ベース運用ルールを CLAUDE.md に明文化 | [PR #1](../../pull/1) |
| #2 | rapid-merge ルール + GitHub Pages 自動デプロイ追加 | [PR #2](../../pull/2) |
| #3 | 背景を黒・文字を白に変更 | [PR #3](../../pull/3) |
| #4 | Google Labs design.md examples を `design/` に追加 | [PR #4](../../pull/4) |
| #5 | Shopify が自動投入した Oxygen デプロイ workflow | [PR #5](../../pull/5) |
| #6 | Hydrogen scaffold + 30%OFF 価格ロジック + こんにちはトップ + scaffold 安全ルール | [PR #6](../../pull/6) |
| #7 | カテゴリページ整備 + トップ「カテゴリから探す」 + メタタイトルブランディング統一 | [PR #7](../../pull/7) |
| #8 | 旧 Pages 撤去 + Vercel ビルド抑制 + CLAUDE.md デプロイ章を Oxygen に更新 | [PR #8](../../pull/8) |
| #9 | モバイル app UI（BottomNav）+ ヘッダー/フッター刷新 + カテゴリカード統一 | [PR #9](../../pull/9) |
| #10 | Vercel ビルドを no-op で成功させる + 案内 placeholder | [PR #10](../../pull/10) |
| #11 | Vercel ダッシュボードに残っていた失敗履歴を上書きするための no-op success | [PR #11](../../pull/11) |

## 6. 宙ぶらりんになっている PR

### PR #12 — Vercel URL → Oxygen への redirect

- <https://github.com/kazaana-memoco-team/kazaana-memoco-team-repository/pull/12>
- Vercel preview URL に来た訪問者を Oxygen URL に 302 で転送する設定
- **判断待ち**: ユーザーが「Vercel プロジェクトを完全切断する」方針を選んだ場合、この PR は **クローズ**（不要）。「Vercel を残す」なら **マージ**

詳細は本書 §7 の課題 1 を参照。

## 7. 次の人がやること（優先度順）

### 課題 1: Vercel プロジェクトをどうするか（要ユーザー判断）

**現状**: Vercel が GitHub repo に紐付いており、毎 push で no-op build が走る（`vercel.json` で `buildCommand: "true"` にしてある）。本番ホスティングは Oxygen が担うので、Vercel の付加価値は **ゼロ**。

**選択肢**:

- **A. 完全切断（推奨）**
  - ユーザー作業: Vercel ダッシュボード → Settings → Delete Project
    - <https://vercel.com/kazaana-memoco/kazaana-memoco-team-repository>
  - その後の Claude 作業: PR #12 をクローズ + `vercel.json` と `public/index.html` を削除する PR を出す
- **B. 残してリダイレクト**
  - PR #12 をマージ → Vercel preview URL は Oxygen URL に 302 転送
  - 残課題: 毎 push で Vercel ビルドが 1〜2 秒走る（無害）

### 課題 2: `member.thebecos.com` カスタムドメイン接続（要管理者作業）

Oxygen 既定 URL は OAuth 保護のため curl/未ログインブラウザで 403 になる。`member.thebecos.com` を当てれば公開アクセス可能になる。

**手順**:

1. Shopify admin → **Hydrogen** チャネル → ストアフロント `会員制BECOS`
2. **Domains** タブ → `Add a custom domain` → `member.thebecos.com`
3. Shopify が出す CNAME 値を確認
4. `thebecos.com` の DNS で `member` の CNAME を設定（`thebecos.com` の DNS が Shopify 管理なら自動）
5. SSL provisioning が完了したら Hydrogen storefront 設定で **Primary domain** を切替、必要なら **Storefront protection** を Off

設定完了後、Claude 側で:
- 各種 meta canonical の URL を `https://member.thebecos.com/` に更新
- `public/index.html` の redirect 先 URL も更新（PR #12 をマージしている場合）

### 課題 3: 30%OFF 表示と Shopify checkout 元価格課金のずれ（要設計判断）

**問題**: 現状サイト上では `¥1,100,000 → ¥770,000 (30%OFF)` のように表示されるが、商品をカートに入れて Shopify checkout に進むと **元価格 (¥1,100,000) で課金**される。Shopify は割引の存在を知らない。

**解決アプローチ候補**:

- **(a) Discount Code を自動付与**: Shopify Admin で `KAZAANA30` のような 30%OFF コードを作成 → Hydrogen 側で `useDiscountCode('KAZAANA30')` を cart 全体に常時適用
  - 実装は数十行
  - Shopify 標準のキャンペーン機構を使うので副作用が予測しやすい
- **(b) Cart Function / Shopify Functions**: 商品 line ごとに割引を適用する Shopify Function を deploy
  - より柔軟（per-handle override も Function 内で可能）
  - 実装難度・運用コストは (a) より高い
- **(c) 表示のみと割り切る**: 「カートに入れる」を撤去して `thebecos.com で購入する` 外部リンクに統一
  - 実装最小だが「30%OFF」表記の意味が薄くなる

**推奨**: (a) でまず動かし、要件が固まったら (b) を検討。

### 課題 4: typecheck で出ているスケルトン由来エラー 4 件（低優先）

`npm run typecheck` で:

- `app/components/PaginatedResourceSection.tsx:42`（React 19 の Promise 型整合性）
- `app/components/SearchForm.tsx:32, 40`（`RefObject<T | null>` vs `RefObject<T>`）

ビルド・実行時には問題なし（CI も緑）。Hydrogen skeleton template の上流バグ。upstream 修正を待つか、フォークの diff として local fix するか判断する。

## 8. リポ運用上の注意

### scaffold 系コマンドの取り扱い

`npm create *` `*-init` 等の scaffolder は `.git` を上書きする可能性あり。詳細は [CLAUDE.md](CLAUDE.md) §「必須 4: 破壊的可能性のある CLI を既存リポで実行する前に保険を張る」を必読。

### auto-merge

リポ Settings で `Allow auto-merge: ON` にしてある（API 経由で設定済）。CLAUDE.md にも `gh pr merge --auto --squash` を運用標準として記載。

### branch 自動削除

`Delete head branches automatically: ON` にしてあるので、squash merge 後にリモート feature branch は自動削除される。ローカルは手動で `git branch -d <name>`。

## 9. 質問されたら答えにくいこと（コード/git 履歴で確認すべきこと）

- 「30%OFF はどこに書いてある？」 → [app/lib/pricing.ts](app/lib/pricing.ts) `DEFAULT_DISCOUNT`
- 「特定商品だけ違う価格にしたい」 → 同ファイルの `PRICE_OVERRIDES` に handle と JPY 数値を追加
- 「カテゴリページのレイアウトは？」 → [app/routes/collections.$handle.tsx](app/routes/collections.$handle.tsx) + [app/styles/app.css](app/styles/app.css)
- 「モバイル UI はどうなってる？」 → [app/components/BottomNav.tsx](app/components/BottomNav.tsx) + CSS の `@media (max-width: 47.99em)` ブロック
