// thebecos の元価格をこのサイト上で表示する際の価格変換ロジック。
// デフォルトでは一律 30%OFF（×0.7）。Supabase product_discounts に登録された
// 商品ハンドルは個別の discount_rate（例: 0.6 = 40%OFF）が優先される。
// discounts マップは root loader が ~/lib/discounts の getDiscountMap で取得し、
// コンポーネントへは useRouteLoaderData('root') 経由で届く。

import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';

export const DEFAULT_DISCOUNT = 0.7;

/** 商品ハンドル → 掛け率（0.6 = 40%OFF）。Supabase product_discounts 由来 */
export type DiscountMap = Record<string, number>;

export const PRICE_OVERRIDES: Record<string, number> = {
  // "s0111-462": 1980,
};

export function applyDiscount(
  price: MoneyV2,
  handle?: string,
  discounts?: DiscountMap,
): MoneyV2 {
  const original = Number(price.amount);
  if (!Number.isFinite(original)) return price;

  const override = handle ? PRICE_OVERRIDES[handle] : undefined;
  const rate = (handle && discounts?.[handle]) || DEFAULT_DISCOUNT;
  const next = override != null ? override : Math.round(original * rate);

  if (next === original) return price;
  return {amount: String(next), currencyCode: price.currencyCode};
}

export function getDiscountPercent(handle?: string, discounts?: DiscountMap): number {
  const rate = (handle && discounts?.[handle]) || DEFAULT_DISCOUNT;
  return Math.round((1 - rate) * 100);
}
