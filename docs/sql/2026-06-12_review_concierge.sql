-- JAPAN BENEFITS レビュー記事にコンシェルジュのコメントを追加 2026-06-12 (PR-A2)
-- 「スタッフからの一押しポイント」の吹き出し(BECOSコンシェルジュのコメント文)を
-- キャッシュするための列を追加。既存キャッシュは概要のみのため一度クリアし、
-- 次回閲覧時にコンシェルジュ込みで再取得させる(product_reviews はキャッシュなので安全)。

alter table public.product_reviews
  add column if not exists concierge_text text default null;

-- 既存キャッシュをクリア(次回アクセスでコンシェルジュ込み再取得)
delete from public.product_reviews;
