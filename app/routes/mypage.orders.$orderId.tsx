import {Link, useLoaderData} from 'react-router';
import {redirect} from 'react-router';
import {requireAuth} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import {
  carrierName,
  collectProductIds,
  fetchProductImages,
  orderKind,
  orderKindLabel,
  paymentLabel,
  type OrderRow,
} from '~/lib/order-display';
import type {Route} from './+types/mypage.orders.$orderId';

export async function loader({request, context, params}: Route.LoaderArgs) {
  const user = await requireAuth(request, context.env);
  const supabase = createSupabaseAdmin(context.env);

  // user_id 条件付きで取得 = 他人の注文は見えない
  const {data: order} = await supabase
    .from('orders')
    .select(
      `*,
       order_items(id, shopify_product_id, shopify_variant_id, product_title, quantity, regular_price, member_price)`,
    )
    .eq('id', params.orderId)
    .eq('user_id', user.id)
    .single();

  if (!order) throw redirect('/mypage');

  const images = await fetchProductImages(
    context.storefront,
    collectProductIds([order]),
  );

  return {user, order, images};
}

export default function OrderDetailPage() {
  const {user, order, images} = useLoaderData<typeof loader>();
  const kind = orderKind(order);
  const items: OrderRow[] = order.order_items ?? [];

  const orderDate = new Date(order.created_at).toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
  });

  const subtotal = order.total_member_price ?? 0;
  const shipping = order.shipping_fee != null ? Number(order.shipping_fee) : null;
  const total =
    order.total_paid != null ? Number(order.total_paid) : subtotal;
  const savings =
    order.total_regular_price != null && order.total_member_price != null
      ? order.total_regular_price - order.total_member_price
      : null;

  const fullName =
    user.last_name && user.first_name
      ? `${user.last_name} ${user.first_name}`
      : user.email;

  const addr = order.shipping_address as Record<string, string | null> | null;
  const payment = paymentLabel(order.payment_method);

  return (
    <div className="mypage-page order-detail-page">
      <p className="order-detail-back">
        <Link to="/mypage">← 注文一覧へ戻る</Link>
      </p>

      <div className="page-heading">
        <h1>
          注文{order.order_name ? ` (${order.order_name})` : ''}
        </h1>
        <span style={{color: '#666', fontSize: '0.875rem'}}>
          確認日: {orderDate}
        </span>
      </div>

      {/* 配送追跡（Shopifyの注文詳細と同じく先頭に） */}
      {kind === 'shipped' && (
        <section className="order-detail-card">
          {order.tracking_company || order.tracking_number ? (
            <p className="order-detail-tracking">
              {order.tracking_company && (
                <strong>{carrierName(order.tracking_company)}</strong>
              )}{' '}
              {order.tracking_number &&
                (order.tracking_url ? (
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {order.tracking_number}
                  </a>
                ) : (
                  order.tracking_number
                ))}
            </p>
          ) : null}
          <ul className="order-detail-timeline">
            <li>
              <strong>発送済み</strong>
              <span>
                {order.shipped_at
                  ? new Date(order.shipped_at).toLocaleDateString('ja-JP', {
                      month: 'long',
                      day: 'numeric',
                    })
                  : '-'}
              </span>
            </li>
            <li>
              <strong>確認済み</strong>
              <span>{orderDate}</span>
            </li>
          </ul>
        </section>
      )}
      {kind === 'processing' && (
        <section className="order-detail-card">
          <p style={{margin: 0}}>
            <strong>確認済み</strong>
            <br />
            <span style={{color: '#666', fontSize: '0.875rem'}}>
              これらのアイテムの発送準備をしています。
            </span>
          </p>
        </section>
      )}
      {kind === 'cancelled' && (
        <section className="order-detail-card">
          <p style={{margin: 0}}>
            <strong>{orderKindLabel(order)}</strong>
          </p>
        </section>
      )}

      {/* 商品明細＋金額（Shopifyの注文サマリーと同じ並び） */}
      <section className="order-detail-card">
        <ul className="order-detail-items">
          {items.map((item) => {
            const img = item.shopify_product_id
              ? images[item.shopify_product_id]
              : null;
            const itemSavings =
              item.regular_price != null && item.member_price != null
                ? Number(item.regular_price) - Number(item.member_price)
                : null;
            return (
              <li key={item.id}>
                <div className="order-detail-item-thumb">
                  {img ? (
                    <img src={img} alt="" loading="lazy" />
                  ) : (
                    <span aria-hidden>▦</span>
                  )}
                  {item.quantity > 1 && (
                    <span className="order-detail-item-qty">
                      {item.quantity}
                    </span>
                  )}
                </div>
                <div className="order-detail-item-main">
                  <span>{item.product_title || '商品'}</span>
                  {itemSavings != null && itemSavings > 0 && (
                    <span className="order-detail-item-discount">
                      会員割引 (-¥{itemSavings.toLocaleString('ja-JP')})
                    </span>
                  )}
                </div>
                <div className="order-detail-item-price">
                  {item.regular_price != null && (
                    <s>¥{Number(item.regular_price).toLocaleString('ja-JP')}</s>
                  )}
                  <strong>
                    ¥{Number(item.member_price ?? 0).toLocaleString('ja-JP')}
                  </strong>
                </div>
              </li>
            );
          })}
        </ul>

        <dl className="order-detail-totals">
          <div>
            <dt>小計・{items.reduce((n, i) => n + (i.quantity ?? 0), 0)}アイテム</dt>
            <dd>¥{subtotal.toLocaleString('ja-JP')}</dd>
          </div>
          <div>
            <dt>配送</dt>
            <dd>
              {shipping == null
                ? '-'
                : shipping === 0
                  ? '無料'
                  : `¥${shipping.toLocaleString('ja-JP')}`}
            </dd>
          </div>
          <div className="order-detail-grand-total">
            <dt>合計</dt>
            <dd>¥{total.toLocaleString('ja-JP')}</dd>
          </div>
          {savings != null && savings > 0 && (
            <div className="order-detail-savings">
              <dt>合計値引き額</dt>
              <dd>¥{savings.toLocaleString('ja-JP')}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* 連絡先・配送先・決済（Shopifyの注文詳細と同じ構成） */}
      <section className="order-detail-card order-detail-info">
        <div>
          <h3>連絡先情報</h3>
          <p>
            {fullName}
            <br />
            {user.email}
          </p>
        </div>
        {addr && (
          <div>
            <h3>配送先住所</h3>
            <p>
              {addr.zip && (
                <>
                  〒{addr.zip}
                  <br />
                </>
              )}
              {[addr.province, addr.city, addr.address1]
                .filter(Boolean)
                .join(' ')}
              {addr.address2 && (
                <>
                  <br />
                  {addr.address2}
                </>
              )}
              {addr.name && (
                <>
                  <br />
                  {addr.name}様
                </>
              )}
              {addr.phone && (
                <>
                  <br />
                  {addr.phone}
                </>
              )}
            </p>
          </div>
        )}
        {payment && (
          <div>
            <h3>決済</h3>
            <p>
              {payment}
              <br />
              ¥{total.toLocaleString('ja-JP')} JPY
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
