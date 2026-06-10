-- JAPAN BENEFITS マイグレーション 2026-06-11
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- https://supabase.com/dashboard/project/izhncvsidxxicyiugfhv/sql
--
-- 1) 発送状況（P0-2）: fulfillments/create Webhook が書き込み、/mypage が表示
-- 2) ご契約内容（dashboard v2）: /dashboard/plan が表示

-- 1) orders に発送状況カラムを追加
alter table public.orders add column if not exists fulfillment_status text default null;
alter table public.orders add column if not exists tracking_number text default null;
alter table public.orders add column if not exists tracking_url text default null;
alter table public.orders add column if not exists shipped_at timestamptz default null;

-- 2) companies に契約情報カラムを追加
alter table public.companies add column if not exists plan_name text default null;
alter table public.companies add column if not exists contract_start date default null;
alter table public.companies add column if not exists contract_end date default null;

-- 動作確認（任意）
-- select column_name from information_schema.columns where table_name = 'orders';
