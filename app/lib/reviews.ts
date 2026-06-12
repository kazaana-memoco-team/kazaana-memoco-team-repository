// 商品ページの「スタッフの一押しポイント」(レビュー記事)画像を取得する。
//
// レビュー記事は BECOS-JP のテーマが pd_<code>_N.jpg 画像として商品ページに描画している
// (商品の body_html / metafield には無い)。JB は別ストアフロントのため引き継がれない。
// そこで BECOS-JP のレンダリング済みページから画像URLを抽出し、Supabase にキャッシュする:
//   1) product_reviews テーブルに鮮度内のキャッシュがあれば即返す
//   2) 無ければ www.thebecos.com/products/<handle> を取得し pd_ 画像を順序保持で抽出
//   3) 抽出結果を upsert してキャッシュ(次回以降は再利用)
//
// テーブル未作成や取得失敗時は安全に空配列を返す(商品ページは正常に表示される)。

import {createSupabaseAdmin} from '~/lib/supabase';

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1週間。期限切れで再取得
const memCache = new Map<string, {urls: string[]; expiresAt: number}>();

// レビュー記事の画像は pd_<code>_N.jpg の連番命名で、ページ内ではこのセクションにのみ出現する
const PD_IMAGE_RE =
  /https:\/\/cdn\.shopify\.com\/[^\s"')]+\/files\/pd_[a-z0-9-]+_\d+\.jpg(?:\?[^\s"')]*)?/gi;

type ReviewEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

/** BECOS-JP のレンダリング済み商品ページからレビュー画像URLを抽出(順序保持・重複除去) */
async function scrapeReviewImages(handle: string): Promise<string[]> {
  const res = await fetch(`https://www.thebecos.com/products/${handle}`, {
    headers: {'User-Agent': 'Mozilla/5.0 (compatible; JapanBenefitsBot/1.0)'},
  });
  if (!res.ok) throw new Error(`thebecos ${res.status}`);
  const html = await res.text();
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const m of html.matchAll(PD_IMAGE_RE)) {
    const url = m[0];
    const key = url.split('?')[0]; // バージョンクエリ違いの重複を除去
    if (!seen.has(key)) {
      seen.add(key);
      urls.push(url);
    }
  }
  return urls;
}

/** 商品ハンドル → レビュー記事の画像URL配列。キャッシュ優先・失敗時は空配列 */
export async function getReviewImages(
  env: ReviewEnv,
  handle: string,
): Promise<string[]> {
  const mem = memCache.get(handle);
  if (mem && Date.now() < mem.expiresAt) return mem.urls;

  const supabase = createSupabaseAdmin(env);

  // 1) Supabase キャッシュ
  let cached: {image_urls: unknown; updated_at: string} | null = null;
  try {
    const {data} = await supabase
      .from('product_reviews')
      .select('image_urls, updated_at')
      .eq('product_handle', handle)
      .maybeSingle();
    cached = (data as typeof cached) ?? null;
  } catch {
    cached = null; // テーブル未作成など
  }

  if (
    cached &&
    Date.now() - new Date(cached.updated_at).getTime() < TTL_MS
  ) {
    const urls = Array.isArray(cached.image_urls)
      ? (cached.image_urls as string[])
      : [];
    memCache.set(handle, {urls, expiresAt: Date.now() + TTL_MS});
    return urls;
  }

  // 2) BECOS-JP から抽出して 3) キャッシュ更新
  try {
    const urls = await scrapeReviewImages(handle);
    try {
      await supabase.from('product_reviews').upsert(
        {
          product_handle: handle,
          image_urls: urls,
          updated_at: new Date().toISOString(),
        },
        {onConflict: 'product_handle'},
      );
    } catch {
      // キャッシュ書込み失敗は致命ではない(表示は継続)
    }
    memCache.set(handle, {urls, expiresAt: Date.now() + TTL_MS});
    return urls;
  } catch (e) {
    console.error('[reviews] 取得失敗:', handle, e);
    // 取得に失敗しても古いキャッシュがあれば使う
    const fallback =
      cached && Array.isArray(cached.image_urls)
        ? (cached.image_urls as string[])
        : [];
    return fallback;
  }
}
