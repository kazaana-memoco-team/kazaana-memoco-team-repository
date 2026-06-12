import {applyDiscount, type DiscountMap} from '~/lib/pricing';
import type {CurrencyCode} from '@shopify/hydrogen/storefront-api-types';

/** 福利厚生注文に必ず課金する送料（全国一律・JPY）。沖縄等の出し分けは Phase 2。 */
const SHIPPING_FEE_JPY = '880';

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
  discounts?: DiscountMap,
  shippingAddress?: Record<string, string>,
): Promise<string | null> {
  const domain = env.SHOPIFY_STORE_DOMAIN || 'thebecos.myshopify.com';

  const draftLineItems = lineItems.map((item) => {
    const memberPrice = applyDiscount(
      {amount: item.regularPrice, currencyCode: item.currencyCode},
      item.productHandle,
      discounts,
    );
    const discountAmount = Number(item.regularPrice) - Number(memberPrice.amount);
    return {
      variant_id: toNumericId(item.variantGid),
      quantity: item.quantity,
      applied_discount: {
        value_type: 'fixed_amount',
        value: formatPrice(String(discountAmount), item.currencyCode),
        title: '会員割引',
      },
    };
  });

  const noteLines = ['JAPAN BENEFITSサイト経由の注文'];
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
          // 会員が選択した保存済み配送先を事前入力（Shopify決済画面で編集可）
          ...(shippingAddress ? {shipping_address: shippingAddress} : {}),
          // 福利厚生は「ほぼ原価＋送料」モデルのため、注文金額にかかわらず
          // 必ず送料を課金する（店舗の「○円以上送料無料」を上書き）。
          // shipping_line を明示すると Draft Order 決済時に店舗の自動送料計算を
          // 使わず、この固定送料が適用される。
          // ※ 沖縄等の地域別出し分け（¥1,980）は住所確定タイミングの都合で Phase 2。
          shipping_line: {
            title: '送料',
            price: SHIPPING_FEE_JPY,
          },
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
