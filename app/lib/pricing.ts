// thebecos の元価格をこのサイト上で表示する際の価格変換ロジック。
// デフォルトでは一律 30%OFF（×0.7）、PRICE_OVERRIDES に handle を入れると
// その商品だけ任意の金額に上書きできる。

import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';

export const DEFAULT_DISCOUNT = 0.7;

// カートに自動付与する会員割引コード
// Shopify Admin → Discounts で "KAZAANA30"（30%OFF・全商品対象）を事前作成しておくこと
export const MEMBER_DISCOUNT_CODE = 'KAZAANA30';

export const PRICE_OVERRIDES: Record<string, number> = {
  // "s0111-462": 1980,
};

export function applyDiscount(price: MoneyV2, handle?: string): MoneyV2 {
  const original = Number(price.amount);
  if (!Number.isFinite(original)) return price;

  const override = handle ? PRICE_OVERRIDES[handle] : undefined;
  const next = override != null ? override : Math.round(original * DEFAULT_DISCOUNT);

  if (next === original) return price;
  return {amount: String(next), currencyCode: price.currencyCode};
}

export function getDiscountPercent(): number {
  return Math.round((1 - DEFAULT_DISCOUNT) * 100);
}
