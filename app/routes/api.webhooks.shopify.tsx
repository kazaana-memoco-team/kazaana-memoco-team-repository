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

  const {data: savedOrder, error: orderError} = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      company_id: user?.company_id ?? null,
      shopify_order_id: String(order.id),
      status: 'paid',
      total_regular_price: totalRegularPrice,
      total_member_price: Number(order.total_price),
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

interface ShopifyOrder {
  id: number;
  tags: string;
  note: string;
  total_price: string;
  created_at: string;
  line_items: Array<{
    product_id: number | null;
    variant_id: number | null;
    quantity: number;
    price: string;
    total_discount: string;
  }>;
}
