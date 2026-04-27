import {useFetcher, useLoaderData, Link} from 'react-router';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import {DEFAULT_DISCOUNT} from '~/lib/pricing';
import type {Route} from './+types/admin.discounts';

type ActionData = {error?: string; success?: string};

export async function loader({request, context}: Route.LoaderArgs) {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);
  const {data: discounts} = await supabase
    .from('product_discounts')
    .select('shopify_product_id, discount_rate')
    .order('shopify_product_id');
  return {discounts: discounts ?? [], defaultDiscount: Math.round((1 - DEFAULT_DISCOUNT) * 100)};
}

export async function action({request, context}: Route.ActionArgs): Promise<ActionData> {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');

  if (intent === 'upsert') {
    const handle = String(formData.get('handle') ?? '').trim();
    const ratePercent = Number(formData.get('rate') ?? 0);
    if (!handle) return {error: '商品ハンドルを入力してください'};
    if (ratePercent < 1 || ratePercent > 99) return {error: '割引率は1〜99%で入力してください'};
    const {error} = await supabase
      .from('product_discounts')
      .upsert(
        {shopify_product_id: handle, discount_rate: (100 - ratePercent) / 100},
        {onConflict: 'shopify_product_id'},
      );
    if (error) return {error: error.message};
    return {success: `「${handle}」の割引率を ${ratePercent}%OFF に設定しました`};
  }

  if (intent === 'delete') {
    const handle = String(formData.get('handle') ?? '');
    const {error} = await supabase
      .from('product_discounts')
      .delete()
      .eq('shopify_product_id', handle);
    if (error) return {error: error.message};
    return {success: `「${handle}」をデフォルト割引率に戻しました`};
  }

  return {error: '不明な操作です'};
}

export default function AdminDiscountsPage() {
  const {discounts, defaultDiscount} = useLoaderData<typeof loader>();
  const upsertFetcher = useFetcher<ActionData>();

  return (
    <div className="admin-page">
      <div className="page-heading">
        <h1>商品別割引率の設定</h1>
        <Link to="/admin" style={{fontSize: '0.875rem', color: '#2563eb'}}>← 運営管理トップ</Link>
      </div>

      <p style={{color: '#555', marginBottom: '1rem'}}>
        デフォルト割引率: <strong>{defaultDiscount}%OFF</strong>（全商品一律）。
        下記に登録した商品のみ個別の割引率が適用されます。
      </p>

      <div style={{background: '#fef9c3', border: '1px solid #fde047', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.875rem'}}>
        商品ハンドルは Shopify 管理画面 → 商品詳細 の URL 末尾（例:{' '}
        <code>thebecos.myshopify.com/products/<strong>s0111-462</strong></code>）で確認できます。
      </div>

      <section className="admin-section">
        <h2>割引率を追加・変更</h2>
        <upsertFetcher.Form method="post" className="form-row">
          <input type="hidden" name="intent" value="upsert" />
          <div className="form-group">
            <label htmlFor="handle">商品ハンドル</label>
            <input id="handle" type="text" name="handle" required placeholder="例: s0111-462" className="form-input" style={{width: 220}} />
          </div>
          <div className="form-group">
            <label htmlFor="rate">割引率（%OFF）</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
              <input id="rate" type="number" name="rate" required min="1" max="99" placeholder="40" className="form-input" style={{width: 70}} />
              <span style={{fontSize: '0.875rem'}}>% OFF</span>
            </div>
          </div>
          <button type="submit" disabled={upsertFetcher.state !== 'idle'} className="btn-primary">
            設定
          </button>
        </upsertFetcher.Form>
        {upsertFetcher.data?.error && <p className="msg-error">{upsertFetcher.data.error}</p>}
        {upsertFetcher.data?.success && <p className="msg-success">{upsertFetcher.data.success}</p>}
      </section>

      <section>
        <h2>個別設定済み商品</h2>
        {discounts.length === 0 ? (
          <p style={{color: '#666'}}>個別設定なし（全商品 {defaultDiscount}%OFF）</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>商品ハンドル</th>
                <th>割引率</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <DiscountRow key={d.shopify_product_id} discount={d} defaultDiscount={defaultDiscount} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function DiscountRow({discount, defaultDiscount}: {discount: {shopify_product_id: string; discount_rate: number}; defaultDiscount: number}) {
  const fetcher = useFetcher<ActionData>();
  const offPercent = Math.round((1 - discount.discount_rate) * 100);
  return (
    <tr>
      <td style={{fontFamily: 'monospace'}}>{discount.shopify_product_id}</td>
      <td>
        <span style={{fontWeight: 600, color: offPercent > defaultDiscount ? '#dc2626' : '#2563eb'}}>
          {offPercent}% OFF
        </span>
        {offPercent !== defaultDiscount && (
          <span style={{fontSize: '0.75rem', color: '#888', marginLeft: '0.5rem'}}>
            （デフォルト: {defaultDiscount}%）
          </span>
        )}
      </td>
      <td>
        <fetcher.Form
          method="post"
          onSubmit={(e) => {
            if (!confirm(`「${discount.shopify_product_id}」をデフォルト（${defaultDiscount}%OFF）に戻しますか？`))
              e.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="handle" value={discount.shopify_product_id} />
          <button type="submit" className="btn-sm">削除（デフォルトに戻す）</button>
        </fetcher.Form>
        {fetcher.data?.error && <p className="msg-error msg-sm">{fetcher.data.error}</p>}
      </td>
    </tr>
  );
}
