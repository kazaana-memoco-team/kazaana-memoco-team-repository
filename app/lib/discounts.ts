// Supabase product_discounts テーブルから商品別割引率マップを取得する。
// root loader から毎リクエスト呼ばれるため、Worker インスタンス内で短い TTL の
// メモリキャッシュを持つ（Oxygen は複数 isolate のため完全な即時反映は TTL に依存）。

import {createSupabaseAdmin} from '~/lib/supabase';
import type {DiscountMap} from '~/lib/pricing';

const TTL_MS = 60_000;

let cache: {map: DiscountMap; expiresAt: number} | null = null;

/** 商品ハンドル → 掛け率（0.6 = 40%OFF）のマップを取得（60秒キャッシュ） */
export async function getDiscountMap(env: Env): Promise<DiscountMap> {
  if (cache && Date.now() < cache.expiresAt) return cache.map;

  try {
    const supabase = createSupabaseAdmin(env);
    const {data, error} = await supabase
      .from('product_discounts')
      .select('shopify_product_id, discount_rate');
    if (error) throw error;

    const map: DiscountMap = {};
    for (const row of data ?? []) {
      const rate = Number(row.discount_rate);
      // 不正値（0以下・1以上）は無視してデフォルト割引にフォールバック
      if (row.shopify_product_id && rate > 0 && rate < 1) {
        map[row.shopify_product_id] = rate;
      }
    }
    cache = {map, expiresAt: Date.now() + TTL_MS};
    return map;
  } catch (e) {
    console.error('[discounts] product_discounts の取得に失敗:', e);
    // 失敗時は期限切れキャッシュがあればそれを、なければ空（=全品デフォルト30%OFF）
    return cache?.map ?? {};
  }
}

/** admin での割引変更直後に同一 isolate のキャッシュを破棄する */
export function clearDiscountCache(): void {
  cache = null;
}
