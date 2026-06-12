// 商品ページの「スタッフからの一押しポイント」(レビュー記事)を取得する。
//
// レビュー記事は BECOS-JP のテーマが描画している(商品の body_html / metafield には無い):
//   <div class="card"> スタッフからの一押しポイント
//     <div class="voice"> [コンシェルジュ画像] + コメント文(.voice-text) </div>
//     ...pd_<code>_N.jpg 画像...
//   </div>
// JB は別ストアフロントのため引き継がれない。そこで BECOS-JP のレンダリング済みページから
// コンシェルジュのコメントと画像URLを抽出し、Supabase(product_reviews)にキャッシュする
//   1) 鮮度内のキャッシュがあれば即返す
//   2) 無ければ www.thebecos.com/products/<handle> を取得して抽出
//   3) upsert してキャッシュ(次回以降は再利用)
//
// テーブル未作成や取得失敗時は安全に空を返す(商品ページは正常に表示される)。

import {createSupabaseAdmin} from '~/lib/supabase';

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1週間。期限切れで再取得

export type ReviewContent = {images: string[]; concierge: string | null};

const memCache = new Map<string, {content: ReviewContent; expiresAt: number}>();

// レビュー記事の画像は pd_<code>_N.jpg の連番命名で、ページ内ではこのセクションにのみ出現する
const PD_IMAGE_RE =
  /https:\/\/cdn\.shopify\.com\/[^\s"')]+\/files\/pd_[a-z0-9-]+_\d+\.jpg(?:\?[^\s"')]*)?/gi;
// コンシェルジュのコメント文(吹き出し)
const VOICE_TEXT_RE = /<p[^>]*class="voice-text"[^>]*>([\s\S]*?)<\/p>/i;

type ReviewEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

/** HTML断片をプレーンテキスト化(タグ除去・主要エンティティ復号) */
function htmlToText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** BECOS-JP のレンダリング済み商品ページからレビュー内容を抽出 */
async function scrapeReviewContent(handle: string): Promise<ReviewContent> {
  const res = await fetch(`https://www.thebecos.com/products/${handle}`, {
    headers: {'User-Agent': 'Mozilla/5.0 (compatible; JapanBenefitsBot/1.0)'},
  });
  if (!res.ok) throw new Error(`thebecos ${res.status}`);
  const html = await res.text();

  // 画像(順序保持・重複除去)
  const seen = new Set<string>();
  const images: string[] = [];
  for (const m of html.matchAll(PD_IMAGE_RE)) {
    const url = m[0];
    const key = url.split('?')[0]; // バージョンクエリ違いの重複を除去
    if (!seen.has(key)) {
      seen.add(key);
      images.push(url);
    }
  }

  // コンシェルジュのコメント文
  const vm = html.match(VOICE_TEXT_RE);
  const concierge = vm ? htmlToText(vm[1]) || null : null;

  return {images, concierge};
}

const EMPTY: ReviewContent = {images: [], concierge: null};

/** 商品ハンドル → レビュー内容(画像＋コンシェルジュ)。キャッシュ優先・失敗時は空 */
export async function getReviewContent(
  env: ReviewEnv,
  handle: string,
): Promise<ReviewContent> {
  const mem = memCache.get(handle);
  if (mem && Date.now() < mem.expiresAt) return mem.content;

  const supabase = createSupabaseAdmin(env);

  // 1) Supabase キャッシュ
  let cached:
    | {image_urls: unknown; concierge_text: string | null; updated_at: string}
    | null = null;
  try {
    const {data} = await supabase
      .from('product_reviews')
      .select('image_urls, concierge_text, updated_at')
      .eq('product_handle', handle)
      .maybeSingle();
    cached = (data as typeof cached) ?? null;
  } catch {
    cached = null; // テーブル未作成など
  }

  if (cached && Date.now() - new Date(cached.updated_at).getTime() < TTL_MS) {
    const content: ReviewContent = {
      images: Array.isArray(cached.image_urls)
        ? (cached.image_urls as string[])
        : [],
      concierge: cached.concierge_text ?? null,
    };
    memCache.set(handle, {content, expiresAt: Date.now() + TTL_MS});
    return content;
  }

  // 2) BECOS-JP から抽出して 3) キャッシュ更新
  try {
    const content = await scrapeReviewContent(handle);
    try {
      await supabase.from('product_reviews').upsert(
        {
          product_handle: handle,
          image_urls: content.images,
          concierge_text: content.concierge,
          updated_at: new Date().toISOString(),
        },
        {onConflict: 'product_handle'},
      );
    } catch {
      // キャッシュ書込み失敗は致命ではない(表示は継続)
    }
    memCache.set(handle, {content, expiresAt: Date.now() + TTL_MS});
    return content;
  } catch (e) {
    console.error('[reviews] 取得失敗:', handle, e);
    // 取得に失敗しても古いキャッシュがあれば使う
    if (cached) {
      return {
        images: Array.isArray(cached.image_urls)
          ? (cached.image_urls as string[])
          : [],
        concierge: cached.concierge_text ?? null,
      };
    }
    return EMPTY;
  }
}
