-- JAPAN BENEFITS レビュー記事(スタッフの一押しポイント)のキャッシュ 2026-06-12 (PR-A)
-- レビュー記事は BECOS-JP のテーマが pd_<code>_N.jpg 画像として商品ページに描画している。
-- JB(Hydrogen)は別ストアフロントのため、BECOS-JP のレンダリング済みページから
-- 画像URLを抽出し、このテーブルにキャッシュする(初回閲覧時に自動取得・以降は再利用)。
-- ※ webhook 等の書込みはなく、app/lib/reviews.ts が upsert する。

create table if not exists public.product_reviews (
  product_handle text primary key,          -- 商品ハンドル(JB=BECOS-JP 共通)
  product_code   text,                       -- 代表商品コード(任意・参考)
  image_urls     jsonb not null default '[]'::jsonb,  -- レビュー画像URLの配列(順序保持)
  updated_at     timestamptz not null default now()
);

-- 取得日時で鮮度判定するためのインデックス
create index if not exists product_reviews_updated_at_idx
  on public.product_reviews (updated_at);
