// Supabase product_exclusions（出品停止商品）の取得。
// discounts.ts と同じ60秒TTLのメモリキャッシュ方式。

import {createSupabaseAdmin} from '~/lib/supabase';

const TTL_MS = 60_000;

let cache: {set: Set<string>; expiresAt: number} | null = null;

/** 出品停止中の商品ハンドル集合を取得（60秒キャッシュ） */
export async function getExclusionSet(env: Env): Promise<Set<string>> {
  if (cache && Date.now() < cache.expiresAt) return cache.set;

  try {
    const supabase = createSupabaseAdmin(env);
    const {data, error} = await supabase
      .from('product_exclusions')
      .select('product_handle');
    if (error) throw error;

    const set = new Set<string>(
      (data ?? []).map((r) => r.product_handle).filter(Boolean),
    );
    cache = {set, expiresAt: Date.now() + TTL_MS};
    return set;
  } catch (e) {
    console.error('[exclusions] product_exclusions の取得に失敗:', e);
    // 失敗時は期限切れキャッシュ or 空（=全品表示）にフォールバック
    return cache?.set ?? new Set();
  }
}

/** admin での変更直後に同一 isolate のキャッシュを破棄する */
export function clearExclusionCache(): void {
  cache = null;
}

/** products 接続（nodes 配列）から出品停止商品を取り除く */
export function filterExcluded<T extends {handle?: string | null}>(
  nodes: T[],
  excluded: Set<string>,
): T[] {
  if (!excluded.size) return nodes;
  return nodes.filter((n) => !n.handle || !excluded.has(n.handle));
}
