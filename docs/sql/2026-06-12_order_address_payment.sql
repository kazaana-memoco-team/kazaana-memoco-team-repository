-- JAPAN BENEFITS マイページ Shopify準拠化 2026-06-12 (PR4)
-- 注文詳細ページに配送先住所・決済方法を表示するための列追加。
-- ※ webhook の insert に新列が含まれるため、デプロイ前に必ず実行すること。

alter table public.orders
  add column if not exists shipping_address jsonb default null; -- Shopify order.shipping_address をそのまま保存
alter table public.orders
  add column if not exists payment_method text default null;    -- 決済方法(payment_gateway_names[0])
