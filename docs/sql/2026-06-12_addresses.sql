-- JAPAN BENEFITS 会員の配送先住所帳 2026-06-12 (PR A-2)
-- 会員ごとに複数の配送先を保存し、チェックアウト時に選択→ドラフトオーダーへ事前入力する。
-- 既存 users の単一住所とは別に、贈答先などを複数管理するためのテーブル。

create table if not exists public.addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  label          text,                              -- 表示名(例: 自宅・実家)
  recipient_name text not null,                     -- お届け先の宛名
  postal_code    text,
  prefecture     text,
  city           text,
  address1       text,                              -- 町名・番地
  building       text,                              -- 建物名・部屋番号
  phone          text,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists addresses_user_id_idx on public.addresses (user_id);
