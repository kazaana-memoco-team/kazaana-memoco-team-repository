// 商品の在庫状況を Admin API から取得する。
// Storefront 公開トークンでは在庫数を読めない(scope外)ため、
// サーバー側(loader)で Admin API を使い、SKU別の在庫数・在庫ポリシーを返す。
// 商品ごとに 60 秒のメモリキャッシュ。

const TTL_MS = 60_000;

export type VariantStock = {
  qty: number;
  policy: 'continue' | 'deny' | string;
};

export type InventoryStatus = 'in_stock' | 'made_to_order' | 'out_of_stock';

const cache = new Map<string, {bySku: Record<string, VariantStock>; expiresAt: number}>();

/** 商品ハンドル → {SKU: 在庫情報} を取得（60秒キャッシュ） */
export async function getProductInventory(
  env: Env,
  handle: string,
): Promise<Record<string, VariantStock>> {
  const hit = cache.get(handle);
  if (hit && Date.now() < hit.expiresAt) return hit.bySku;

  const bySku: Record<string, VariantStock> = {};
  try {
    const domain = env.SHOPIFY_STORE_DOMAIN || 'thebecos.myshopify.com';
    const res = await fetch(
      `https://${domain}/admin/api/2024-01/products.json?handle=${encodeURIComponent(handle)}&fields=variants`,
      {headers: {'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_ACCESS_TOKEN}},
    );
    if (!res.ok) throw new Error(`admin ${res.status}`);
    const data = (await res.json()) as {
      products?: Array<{
        variants?: Array<{
          sku?: string;
          inventory_quantity?: number;
          inventory_policy?: string;
          inventory_management?: string | null;
        }>;
      }>;
    };
    for (const v of data.products?.[0]?.variants ?? []) {
      if (v.sku) {
        bySku[v.sku] = {
          qty: Number(v.inventory_quantity ?? 0),
          policy: v.inventory_policy ?? 'deny',
        };
      }
    }
    cache.set(handle, {bySku, expiresAt: Date.now() + TTL_MS});
  } catch (e) {
    console.error('[inventory] 取得失敗:', handle, e);
    return hit?.bySku ?? {};
  }
  return bySku;
}

/** SKUの在庫情報から表示用ステータスを判定 */
export function stockStatus(stock: VariantStock | undefined): InventoryStatus {
  if (!stock) return 'made_to_order'; // 在庫管理外＝受注扱いで「納期確認」に倒す
  if (stock.qty > 0) return 'in_stock';
  // 在庫0でも continue(取り寄せ可)なら受注扱い、deny なら売り切れ
  return stock.policy === 'continue' ? 'made_to_order' : 'out_of_stock';
}
