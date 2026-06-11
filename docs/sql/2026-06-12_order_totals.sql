-- JAPAN BENEFITS 支払総額・送料の保存 2026-06-12 (PR3)
-- マイページで「送料込みの支払総額」を表示するための列追加。
-- total_member_price は商品のみ（割引額の算出用）、total_paid は実際の支払額。
-- ※ webhook の insert に新列が含まれるため、デプロイ前に必ず実行すること。

alter table public.orders
  add column if not exists total_paid numeric default null;    -- 実際の支払総額(商品+送料、税込)
alter table public.orders
  add column if not exists shipping_fee numeric default null;  -- 送料
