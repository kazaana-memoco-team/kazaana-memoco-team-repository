import {applyDiscount} from '~/lib/pricing';
import type {CurrencyCode} from '@shopify/hydrogen/storefront-api-types';

interface LineItemInput {
  variantGid: string;   // gid://shopify/ProductVariant/12345
  quantity: number;
  regularPrice: string; // 元値（文字列）
  currencyCode: CurrencyCode;
  productHandle: string;
}

/** GID から数値 ID を抽出する */
function toNumericId(gid: string): number {
  return Number(gid.split('/').pop());
}

/**
 * 金額を Draft Orders API 用の文字列にフォーマット
 * JPY は小数点なし整数、他は小数2桁
 */
function formatPrice(amount: string, currencyCode: CurrencyCode): string {
  const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND', 'IDR', 'ISK'];
  const num = Number(amount);
  return zeroDecimalCurrencies.includes(currencyCode as string)
    ? String(Math.round(num))
    : num.toFixed(2);
}

/**
 * Shopify Admin API で Draft Order を作成し、invoice_url を返す
 */
export async function createDraftOrder(
  lineItems: LineItemInput[],
  env: Env,
  meta?: {userId?: string; companyName?: string},
): Promise<string | null> {
  const domain = env.SHOPIFY_STORE_DOMAIN || 'thebecos.myshopify.com';

  const draftLineItems = lineItems.map((item) => {
    const memberPrice = applyDiscount(
      {amount: item.regularPrice, currencyCode: item.currencyCode},
      item.productHandle,
    );
    return {
      variant_id: toNumericId(item.variantGid),
      quantity: item.quantity,
      price: formatPrice(memberPrice.amount, item.currencyCode),
    };
  });

  const noteLines = ['会員制BECOSサイト経由の注文'];
  if (meta?.userId) noteLines.push(`会員ID: ${meta.userId}`);
  if (meta?.companyName) noteLines.push(`企業: ${meta.companyName}`);

  console.log('[DraftOrder] line_items:', JSON.stringify(draftLineItems));

  const response = await fetch(
    `https://${domain}/admin/api/2024-01/draft_orders.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        draft_order: {
          line_items: draftLineItems,
          tags: '福利厚生サイト,kazaana-memoco',
          note: noteLines.join(' / '),
        },
      }),
    },
  );

  if (!response.ok) {
    console.error('[DraftOrder] API error:', response.status, await response.text());
    return null;
  }

  const data = await response.json() as {draft_order?: {invoice_url?: string}};
  return data.draft_order?.invoice_url ?? null;
}
