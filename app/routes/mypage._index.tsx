import {useState} from 'react';
import {Link, useLoaderData} from 'react-router';
import {requireAuth} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import {
  collectProductIds,
  fetchProductImages,
  orderKind,
  orderKindLabel,
  type OrderRow,
} from '~/lib/order-display';
import type {Route} from './+types/mypage._index';

export async function loader({request, context}: Route.LoaderArgs) {
  const user = await requireAuth(request, context.env);
  const supabase = createSupabaseAdmin(context.env);

  // 新カラム未追加でも壊れないよう * で取得する
  const {data: orders} = await supabase
    .from('orders')
    .select(
      `*,
       order_items(id, shopify_product_id, shopify_variant_id, product_title, quantity, regular_price, member_price)`,
    )
    .eq('user_id', user.id)
    .order('created_at', {ascending: false});

  // 商品サムネイル（Storefront APIから・DB保存なし）
  const images = await fetchProductImages(
    context.storefront,
    collectProductIds(orders ?? []),
  );

  return {user, orders: orders ?? [], images};
}

// BECOS本体（Shopify顧客アカウント）と同じステータス文言のタブ
const TABS = [
  {key: 'all', label: 'すべて'},
  {key: 'processing', label: '確認済み'},
  {key: 'shipped', label: '発送済み'},
  {key: 'cancelled', label: 'キャンセル'},
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function MypagePage() {
  const {user, orders, images} = useLoaderData<typeof loader>();
  const [tab, setTab] = useState<TabKey>('all');

  const fullName =
    user.last_name && user.first_name
      ? `${user.last_name} ${user.first_name}`
      : user.email;

  const counts = orders.reduce(
    (acc, o) => {
      acc[orderKind(o)] += 1;
      return acc;
    },
    {processing: 0, shipped: 0, cancelled: 0} as Record<
      Exclude<TabKey, 'all'>,
      number
    >,
  );

  const visible =
    tab === 'all' ? orders : orders.filter((o) => orderKind(o) === tab);

  const totalSavings = orders
    .filter((o) => o.status === 'paid')
    .reduce(
      (sum, o) =>
        sum +
        Math.max(
          0,
          (o.total_regular_price ?? 0) - (o.total_member_price ?? 0),
        ),
      0,
    );

  return (
    <div className="mypage-page">
      <div className="page-heading">
        <h1>マイページ</h1>
        <span style={{color: '#666', fontSize: '0.875rem'}}>{fullName} 様</span>
      </div>

      {totalSavings > 0 && (
        <p className="mypage-savings-banner">
          これまでの割引額 合計{' '}
          <strong>¥{totalSavings.toLocaleString('ja-JP')}</strong>
        </p>
      )}

      <h2>注文</h2>

      <div className="tab-row" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`tab-btn ${tab === t.key ? 'tab-btn-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key !== 'all' && (
              <span className="tab-count">
                {counts[t.key as Exclude<TabKey, 'all'>]}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p style={{color: '#666'}}>
          {tab === 'all'
            ? 'まだ注文がありません。'
            : 'このステータスの注文はありません。'}
        </p>
      ) : (
        <div>
          {visible.map((order) => (
            <OrderListItem key={order.id} order={order} images={images} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Shopify顧客アカウントの注文一覧と同じ構成のカード */
function OrderListItem({
  order,
  images,
}: {
  order: OrderRow;
  images: Record<string, string>;
}) {
  const date = new Date(order.created_at).toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
  });
  const items: OrderRow[] = order.order_items ?? [];
  const itemCount = items.reduce((n, i) => n + (i.quantity ?? 0), 0);
  const thumbs = items
    .map((i) => (i.shopify_product_id ? images[i.shopify_product_id] : null))
    .filter(Boolean)
    .slice(0, 2) as string[];
  const total =
    order.total_paid != null
      ? Number(order.total_paid)
      : (order.total_member_price ?? 0);
  const kind = orderKind(order);

  return (
    <Link to={`/mypage/orders/${order.id}`} className="order-list-item">
      <div className="order-list-thumbs">
        {thumbs.length ? (
          thumbs.map((src) => (
            <img key={src} src={src} alt="" loading="lazy" />
          ))
        ) : (
          <span className="order-list-thumb-placeholder" aria-hidden>
            ▦
          </span>
        )}
      </div>
      <div className="order-list-main">
        <span className={`order-list-status order-list-status-${kind}`}>
          {orderKindLabel(order)}
        </span>
        <span className="order-list-date">{date}</span>
        <span className="order-list-meta">
          {order.order_name ? `${order.order_name}・` : ''}
          {itemCount}個のアイテム
        </span>
      </div>
      <div className="order-list-total">
        ¥{total.toLocaleString('ja-JP')} <span>JPY</span>
      </div>
    </Link>
  );
}
