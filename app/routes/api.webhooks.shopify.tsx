import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/api.webhooks.shopify';

export async function loader() {
  return new Response('Not Found', {status: 404});
}

export async function action({request, context}: Route.ActionArgs) {
  const rawBody = await request.text();

  const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256') ?? '';
  const isValid = await verifyWebhookHmac(
    rawBody,
    hmacHeader,
    context.env.SHOPIFY_WEBHOOK_SECRET,
  );
  if (!isValid) {
    console.warn('[Webhook] HMAC verification failed');
    return new Response('Unauthorized', {status: 401});
  }

  const topic = request.headers.get('X-Shopify-Topic') ?? '';

  if (topic === 'fulfillments/create' || topic === 'fulfillments/update') {
    return handleFulfillment(rawBody, context.env);
  }

  // アプリのスコープでは fulfillments/* トピックを購読できないため、
  // 実運用は orders/fulfilled（注文オブジェクト＝タグ・fulfillments配列入り）を使う
  if (topic === 'orders/fulfilled' || topic === 'orders/partially_fulfilled') {
    return handleOrderFulfilled(rawBody, context.env);
  }

  if (topic !== 'orders/paid') {
    return new Response('OK', {status: 200});
  }

  const order = JSON.parse(rawBody) as ShopifyOrder;

  // 福利厚生サイト経由の注文のみ処理
  const tags = (order.tags ?? '')
    .split(',')
    .map((t) => t.trim());
  if (!tags.includes('福利厚生サイト')) {
    return new Response('OK', {status: 200});
  }

  const userId = extractUserId(order.note ?? '');
  if (!userId) {
    console.error('[Webhook] userId not found in note:', order.note);
    return new Response('OK', {status: 200});
  }

  const supabase = createSupabaseAdmin(context.env);

  const {data: user} = await supabase
    .from('users')
    .select('company_id')
    .eq('id', userId)
    .single();

  const totalRegularPrice = order.line_items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  // 会員価格は「商品のみ」の合計にする（送料・税を含めない）。
  // order.total_price は送料込みのため、送料が課金された注文だと
  // 節約額（通常−会員）が送料の分だけ歪んでしまう不具合があった。
  const totalLineDiscount = order.line_items.reduce(
    (sum, item) => sum + Number(item.total_discount ?? 0),
    0,
  );
  const totalMemberPrice = totalRegularPrice - totalLineDiscount;

  // 実際の支払総額（送料・税込）と送料。マイページで「総額」を表示するため保存。
  const totalPaid = Number(order.total_price);
  const shippingFee = Number(
    order.total_shipping_price_set?.shop_money?.amount ?? 0,
  );

  const {data: savedOrder, error: orderError} = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      company_id: user?.company_id ?? null,
      shopify_order_id: String(order.id),
      order_name: order.name ?? null,
      status: 'paid',
      total_regular_price: totalRegularPrice,
      total_member_price: totalMemberPrice,
      total_paid: totalPaid,
      shipping_fee: shippingFee,
      shipping_address: order.shipping_address ?? null,
      payment_method: order.payment_gateway_names?.[0] ?? null,
      created_at: order.created_at,
    })
    .select('id')
    .single();

  if (orderError) {
    console.error('[Webhook] Failed to insert order:', orderError);
    return new Response('Internal Server Error', {status: 500});
  }

  const orderItems = order.line_items.map((item) => {
    const totalDiscount = Number(item.total_discount ?? 0);
    const memberPrice =
      (Number(item.price) * item.quantity - totalDiscount) / item.quantity;
    const discountRate =
      Number(item.price) > 0 ? totalDiscount / (Number(item.price) * item.quantity) : 0;

    return {
      order_id: savedOrder.id,
      shopify_product_id: item.product_id ? String(item.product_id) : null,
      shopify_variant_id: item.variant_id ? String(item.variant_id) : null,
      product_title: item.title ?? null,
      quantity: item.quantity,
      regular_price: Number(item.price),
      member_price: memberPrice,
      discount_rate: discountRate,
    };
  });

  const {error: itemsError} = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    console.error('[Webhook] Failed to insert order_items:', itemsError);
  }

  console.log('[Webhook] Order saved:', savedOrder.id);
  return new Response('OK', {status: 200});
}

/**
 * orders/fulfilled | orders/partially_fulfilled Webhook。
 * ペイロードは注文オブジェクト。タグで自社注文を判定し、
 * 最新の fulfillment から追跡情報を orders に保存する。
 */
async function handleOrderFulfilled(rawBody: string, env: Env): Promise<Response> {
  const order = JSON.parse(rawBody) as ShopifyOrder & {
    fulfillments?: Array<{
      created_at: string | null;
      tracking_number: string | null;
      tracking_numbers?: string[];
      tracking_url: string | null;
      tracking_urls?: string[];
      tracking_company?: string | null;
    }>;
  };

  const tags = (order.tags ?? '').split(',').map((t) => t.trim());
  if (!tags.includes('福利厚生サイト')) {
    return new Response('OK', {status: 200});
  }

  const latest = order.fulfillments?.[order.fulfillments.length - 1];
  const trackingNumber =
    latest?.tracking_number ?? latest?.tracking_numbers?.[0] ?? null;
  const trackingUrl = latest?.tracking_url ?? latest?.tracking_urls?.[0] ?? null;
  const trackingCompany = latest?.tracking_company ?? null;

  const supabase = createSupabaseAdmin(env);
  const {data, error} = await supabase
    .from('orders')
    .update({
      fulfillment_status: 'shipped',
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      tracking_company: trackingCompany,
      shipped_at: latest?.created_at ?? new Date().toISOString(),
    })
    .eq('shopify_order_id', String(order.id))
    .select('id');

  if (error) {
    // カラム未追加（マイグレーション前）等。Shopifyへはリトライさせない
    console.error('[Webhook] orders/fulfilled update failed:', error.message);
  } else if (data?.length) {
    console.log('[Webhook] shipment saved for order:', data[0].id);
  }
  return new Response('OK', {status: 200});
}

/**
 * 発送（fulfillment）Webhook。
 * ペイロードに注文タグが含まれないため、orders テーブルに存在する
 * shopify_order_id とのマッチで自社注文のみ更新する（他店舗注文はno-op）。
 */
async function handleFulfillment(rawBody: string, env: Env): Promise<Response> {
  const f = JSON.parse(rawBody) as ShopifyFulfillment;
  if (!f.order_id) return new Response('OK', {status: 200});

  const trackingNumber = f.tracking_number ?? f.tracking_numbers?.[0] ?? null;
  const trackingUrl = f.tracking_url ?? f.tracking_urls?.[0] ?? null;

  const supabase = createSupabaseAdmin(env);
  const {data, error} = await supabase
    .from('orders')
    .update({
      fulfillment_status: 'shipped',
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      shipped_at: f.created_at ?? new Date().toISOString(),
    })
    .eq('shopify_order_id', String(f.order_id))
    .select('id');

  if (error) {
    // カラム未追加（マイグレーション前）等。Shopifyへはリトライさせない
    console.error('[Webhook] fulfillment update failed:', error.message);
  } else if (data?.length) {
    console.log('[Webhook] fulfillment saved for order:', data[0].id);
  }
  return new Response('OK', {status: 200});
}

async function verifyWebhookHmac(
  body: string,
  hmacHeader: string,
  secret: string,
): Promise<boolean> {
  if (!secret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body),
  );
  const computed = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  );
  return computed === hmacHeader;
}

function extractUserId(note: string): string | null {
  const match = note.match(
    /会員ID:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  return match?.[1] ?? null;
}

interface ShopifyFulfillment {
  order_id: number | null;
  created_at: string | null;
  tracking_number: string | null;
  tracking_numbers?: string[];
  tracking_url: string | null;
  tracking_urls?: string[];
}

interface ShopifyOrder {
  id: number;
  name: string; // 注文番号(例: BE19758)
  tags: string;
  note: string;
  total_price: string; // 支払総額(送料・税込)
  total_shipping_price_set?: {shop_money?: {amount?: string}}; // 送料
  shipping_address?: {
    name?: string | null;
    zip?: string | null;
    province?: string | null;
    city?: string | null;
    address1?: string | null;
    address2?: string | null;
    phone?: string | null;
  } | null;
  payment_gateway_names?: string[]; // 決済方法
  created_at: string;
  line_items: Array<{
    product_id: number | null;
    variant_id: number | null;
    title: string; // 商品名
    quantity: number;
    price: string;
    total_discount: string;
  }>;
}
