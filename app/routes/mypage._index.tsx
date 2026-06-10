import {useState} from 'react';
import {useLoaderData} from 'react-router';
import {requireAuth} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/mypage._index';

export async function loader({request, context}: Route.LoaderArgs) {
  const user = await requireAuth(request, context.env);
  const supabase = createSupabaseAdmin(context.env);

  // 新カラム（tracking等）未追加でも壊れないよう * で取得する
  const {data: orders} = await supabase
    .from('orders')
    .select(
      `*,
       order_items(id, shopify_product_id, shopify_variant_id, quantity, regular_price, member_price)`,
    )
    .eq('user_id', user.id)
    .order('created_at', {ascending: false});

  return {user, orders: orders ?? []};
}

type OrderRow = Record<string, any>;

// リゾートワークスの予約一覧と同じタブ型ステータス管理
const TABS = [
  {key: 'all', label: 'すべて'},
  {key: 'processing', label: '準備中'},
  {key: 'shipped', label: '発送済み'},
  {key: 'cancelled', label: 'キャンセル'},
] as const;

type TabKey = (typeof TABS)[number]['key'];

function tabOf(order: OrderRow): Exclude<TabKey, 'all'> {
  if (order.status === 'cancelled' || order.status === 'refunded')
    return 'cancelled';
  if (order.shipped_at || order.fulfillment_status === 'shipped')
    return 'shipped';
  return 'processing';
}

export default function MypagePage() {
  const {user, orders} = useLoaderData<typeof loader>();
  const [tab, setTab] = useState<TabKey>('all');

  const fullName =
    user.last_name && user.first_name
      ? `${user.last_name} ${user.first_name}`
      : user.email;

  const counts = orders.reduce(
    (acc, o) => {
      acc[tabOf(o)] += 1;
      return acc;
    },
    {processing: 0, shipped: 0, cancelled: 0} as Record<
      Exclude<TabKey, 'all'>,
      number
    >,
  );

  const visible =
    tab === 'all' ? orders : orders.filter((o) => tabOf(o) === tab);

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
          これまでの節約額 合計{' '}
          <strong>¥{totalSavings.toLocaleString('ja-JP')}</strong>
        </p>
      )}

      <h2>購入履歴</h2>

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
            ? 'まだ購入履歴がありません。'
            : 'このステータスの注文はありません。'}
        </p>
      ) : (
        <div>
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({order}: {order: OrderRow}) {
  const date = new Date(order.created_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const savings =
    order.total_regular_price != null && order.total_member_price != null
      ? order.total_regular_price - order.total_member_price
      : null;
  const kind = tabOf(order);

  return (
    <div className="order-card">
      <div className="order-card-header">
        <span style={{fontSize: '0.875rem', color: '#666'}}>{date}</span>
        <StatusBadge order={order} kind={kind} />
      </div>

      {kind === 'shipped' && (
        <p className="order-shipping-info">
          発送日:{' '}
          {order.shipped_at
            ? new Date(order.shipped_at).toLocaleDateString('ja-JP')
            : '-'}
          {order.tracking_number && (
            <>
              {' ／ 追跡番号: '}
              {order.tracking_url ? (
                <a href={order.tracking_url} target="_blank" rel="noreferrer">
                  {order.tracking_number}
                </a>
              ) : (
                order.tracking_number
              )}
            </>
          )}
        </p>
      )}

      <dl className="order-prices">
        <div>
          <dt>通常価格</dt>
          <dd>
            <s style={{color: '#aaa'}}>
              ¥{order.total_regular_price?.toLocaleString('ja-JP') ?? '-'}
            </s>
          </dd>
        </div>
        <div>
          <dt>会員価格</dt>
          <dd>¥{order.total_member_price?.toLocaleString('ja-JP') ?? '-'}</dd>
        </div>
        {savings != null && savings > 0 && (
          <div>
            <dt>節約額</dt>
            <dd className="order-savings">
              -¥{savings.toLocaleString('ja-JP')}
            </dd>
          </div>
        )}
      </dl>

      {order.order_items?.length > 0 && (
        <ul
          style={{
            margin: 0,
            paddingLeft: '1rem',
            fontSize: '0.875rem',
            color: '#444',
          }}
        >
          {order.order_items.map((item: OrderRow) => (
            <li key={item.id}>
              数量 {item.quantity} ×{' '}
              {item.member_price != null
                ? `¥${Number(item.member_price).toLocaleString('ja-JP')}`
                : '-'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({order, kind}: {order: OrderRow; kind: string}) {
  if (kind === 'shipped') {
    return <span className="badge badge-active">発送済み</span>;
  }
  if (kind === 'cancelled') {
    return (
      <span className="badge badge-muted">
        {order.status === 'refunded' ? '返金済み' : 'キャンセル'}
      </span>
    );
  }
  return <span className="badge badge-pending">準備中</span>;
}
