/**
 * マイページの注文表示用の共通ヘルパー。
 * ラベルや構成は BECOS 本体（Shopify 顧客アカウント）に合わせる。
 */

export type OrderRow = Record<string, any>;

export type OrderKind = 'processing' | 'shipped' | 'cancelled';

/** 注文の表示ステータスを判定 */
export function orderKind(order: OrderRow): OrderKind {
  if (order.status === 'cancelled' || order.status === 'refunded')
    return 'cancelled';
  if (order.shipped_at || order.fulfillment_status === 'shipped')
    return 'shipped';
  return 'processing';
}

/** Shopify 顧客アカウントと同じステータス文言 */
export function orderKindLabel(order: OrderRow): string {
  const kind = orderKind(order);
  if (kind === 'shipped') return '発送済み';
  if (kind === 'cancelled')
    return order.status === 'refunded' ? '返金済み' : 'キャンセル済み';
  return '確認済み';
}

/** Shopify の配送会社名（例 "Sagawa (JA)"）を日本語表記に変換する */
export function carrierName(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('sagawa')) return '佐川急便';
  if (s.includes('yamato')) return 'ヤマト運輸';
  if (s.includes('japan post') || s.includes('japanpost')) return '日本郵便';
  if (s.includes('seino')) return '西濃運輸';
  if (s.includes('fukuyama')) return '福山通運';
  return raw;
}

/** 決済方法の表示名（Shopify gateway 名 → 日本語） */
export function paymentLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s === 'manual' || s.includes('bank deposit')) return '銀行振込';
  if (s.includes('shopify_payments') || s.includes('credit')) return 'クレジットカード';
  if (s.includes('paypal')) return 'PayPal';
  if (s.includes('paidy')) return 'あと払い（ペイディ）';
  if (s.includes('paypay')) return 'PayPay';
  if (s.includes('merpay') || s.includes('sbps')) return 'メルペイ等（SBPS）';
  return raw; // 日本語名で届くものはそのまま
}

/** 注文に含まれる商品IDの一覧（重複除去） */
export function collectProductIds(orders: OrderRow[]): string[] {
  return [
    ...new Set(
      orders.flatMap((o) =>
        (o.order_items ?? [])
          .map((i: OrderRow) => i.shopify_product_id)
          .filter(Boolean),
      ),
    ),
  ] as string[];
}

export const PRODUCT_IMAGES_QUERY = `#graphql
  query OrderProductImages($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        featuredImage {
          url
          altText
        }
      }
    }
  }
` as const;

/**
 * Storefront API から商品サムネイルを取得して
 * {数値productId: imageUrl} のマップを返す。失敗しても空で返す（表示は継続）。
 */
export async function fetchProductImages(
  storefront: {query: Function; CacheLong: Function},
  productIds: string[],
): Promise<Record<string, string>> {
  const images: Record<string, string> = {};
  if (!productIds.length) return images;
  try {
    const gids = productIds.map((id) => `gid://shopify/Product/${id}`);
    const res = (await storefront.query(PRODUCT_IMAGES_QUERY, {
      variables: {ids: gids},
      cache: storefront.CacheLong(),
    })) as {nodes?: Array<{id?: string; featuredImage?: {url?: string}} | null>};
    for (const node of res?.nodes ?? []) {
      const numericId = node?.id?.split('/').pop();
      if (numericId && node?.featuredImage?.url) {
        images[numericId] = node.featuredImage.url;
      }
    }
  } catch (e) {
    console.error('[order-display] product image fetch failed:', e);
  }
  return images;
}
