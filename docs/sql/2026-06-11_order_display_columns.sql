-- JAPAN BENEFITS マイページ表示拡充 2026-06-11 (PR2)
-- 注文番号・商品名・配送会社をマイページに表示するための列追加。
-- ※ このマイグレーションを先に実行してからコードをデプロイすること。
--    （webhook の insert に新列が含まれるため、列が無いと注文記録が失敗する）

alter table public.orders
  add column if not exists order_name text default null;       -- Shopify注文番号(例: BE19758)
alter table public.orders
  add column if not exists tracking_company text default null; -- 配送会社(例: 佐川急便)

alter table public.order_items
  add column if not exists product_title text default null;    -- 商品名
