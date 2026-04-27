import {useLoaderData} from 'react-router';
import {requireAuth} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/mypage._index';

export async function loader({request, context}: Route.LoaderArgs) {
  const user = await requireAuth(request, context.env);
  const supabase = createSupabaseAdmin(context.env);

  const {data: orders} = await supabase
    .from('orders')
    .select(
      `id, shopify_order_id, status, total_regular_price, total_member_price, created_at,
       order_items(id, shopify_product_id, shopify_variant_id, quantity, regular_price, member_price)`,
    )
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .order('created_at', {ascending: false});

  return {user, orders: orders ?? []};
}

export default function MypagePage() {
  const {user, orders} = useLoaderData<typeof loader>();
  const fullName =
    user.last_name && user.first_name
      ? `${user.last_name} ${user.first_name}`
      : user.email;

  return (
    <div style={{maxWidth: 860, margin: '2rem auto', padding: '0 1rem'}}>
      <h1 style={{marginBottom: '0.25rem'}}>マイページ</h1>
      <p style={{color: '#666', marginBottom: '2rem'}}>{fullName} 様</p>

      <h2>購入履歴</h2>

      {orders.length === 0 ? (
        <p style={{color: '#666'}}>まだ購入履歴がありません。</p>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({order}: {order: Record<string, any>}) {
  const date = new Date(order.created_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const savings =
    order.total_regular_price != null && order.total_member_price != null
      ? order.total_regular_price - order.total_member_price
      : null;

  return (
    <div
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        padding: '1rem 1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '0.75rem',
        }}
      >
        <span style={{fontSize: '0.875rem', color: '#666'}}>{date}</span>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.6rem',
            background: '#f0fdf4',
            color: '#16a34a',
            borderRadius: 12,
          }}
        >
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      <dl
        style={{
          display: 'flex',
          gap: '2rem',
          margin: '0 0 0.75rem',
        }}
      >
        <div>
          <dt style={{fontSize: '0.75rem', color: '#666'}}>通常価格</dt>
          <dd style={{margin: 0}}>
            <s style={{color: '#aaa'}}>
              ¥{order.total_regular_price?.toLocaleString('ja-JP') ?? '-'}
            </s>
          </dd>
        </div>
        <div>
          <dt style={{fontSize: '0.75rem', color: '#666'}}>会員価格</dt>
          <dd style={{margin: 0, fontWeight: 600}}>
            ¥{order.total_member_price?.toLocaleString('ja-JP') ?? '-'}
          </dd>
        </div>
        {savings != null && savings > 0 && (
          <div>
            <dt style={{fontSize: '0.75rem', color: '#666'}}>割引額</dt>
            <dd style={{margin: 0, color: '#16a34a', fontWeight: 600}}>
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
          {order.order_items.map((item: Record<string, any>) => (
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

const STATUS_LABEL: Record<string, string> = {
  paid: '決済済み',
  pending: '処理中',
  refunded: '返金済み',
};
