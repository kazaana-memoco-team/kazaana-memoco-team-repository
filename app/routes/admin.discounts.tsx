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

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ActionData> {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');

  if (intent === 'upsert') {
    const handle = String(formData.get('handle') ?? '').trim();
    const ratePercent = Number(formData.get('rate') ?? 0);

    if (!handle) return {error: '商品ハンドルを入力してください'};
    if (ratePercent < 1 || ratePercent > 99) return {error: '割引率は1〜99%で入力してください'};

    const discountRate = (100 - ratePercent) / 100;

    const {error} = await supabase
      .from('product_discounts')
      .upsert({shopify_product_id: handle, discount_rate: discountRate}, {onConflict: 'shopify_product_id'});
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
    <div style={{maxWidth: 800, margin: '2rem auto', padding: '0 1rem'}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.5rem'}}>
        <Link to="/admin" style={{fontSize: '0.875rem', color: '#2563eb'}}>
          ← 運営管理トップ
        </Link>
        <h1 style={{margin: 0}}>商品別割引率の設定</h1>
      </div>

      <p style={{color: '#666', marginBottom: '1.5rem'}}>
        デフォルト割引率: <strong>{defaultDiscount}%OFF</strong>（全商品一律）。
        下記に登録した商品のみ個別の割引率が適用されます。
      </p>

      <div style={{background: '#fef9c3', border: '1px solid #fde047', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.875rem'}}>
        商品ハンドルは Shopify 管理画面 → 商品 → 商品詳細 の URL 末尾（例:{' '}
        <code>thebecos.myshopify.com/products/<strong>s0111-462</strong></code>）で確認できます。
      </div>

      {/* 追加・編集フォーム */}
      <section style={{marginBottom: '2rem', padding: '1rem 1.5rem', border: '1px solid #e0e0e0', borderRadius: 8}}>
        <h2 style={{marginTop: 0}}>割引率を追加・変更</h2>
        <upsertFetcher.Form method="post" style={{display: 'flex', gap: '0.5rem', alignItems: 'flex-end'}}>
          <input type="hidden" name="intent" value="upsert" />
          <div>
            <label style={{display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem'}}>
              商品ハンドル
            </label>
            <input
              type="text"
              name="handle"
              required
              placeholder="例: s0111-462"
              style={{padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, width: 220}}
            />
          </div>
          <div>
            <label style={{display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem'}}>
              割引率（%OFF）
            </label>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
              <input
                type="number"
                name="rate"
                required
                min="1"
                max="99"
                placeholder="例: 40"
                style={{padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, width: 80}}
              />
              <span style={{fontSize: '0.875rem'}}>% OFF</span>
            </div>
          </div>
          <button
            type="submit"
            disabled={upsertFetcher.state !== 'idle'}
            style={{padding: '0.5rem 1.25rem', background: '#222', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer'}}
          >
            設定
          </button>
        </upsertFetcher.Form>
        {upsertFetcher.data?.error && (
          <p style={{color: '#dc2626', marginTop: '0.5rem', marginBottom: 0}}>{upsertFetcher.data.error}</p>
        )}
        {upsertFetcher.data?.success && (
          <p style={{color: '#16a34a', marginTop: '0.5rem', marginBottom: 0}}>{upsertFetcher.data.success}</p>
        )}
      </section>

      {/* 設定済み一覧 */}
      <section>
        <h2>個別設定済み商品</h2>
        {discounts.length === 0 ? (
          <p style={{color: '#666'}}>個別設定なし（全商品 {defaultDiscount}%OFF が適用されます）</p>
        ) : (
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{borderBottom: '2px solid #222', textAlign: 'left'}}>
                {['商品ハンドル', '割引率', '操作'].map((h) => (
                  <th key={h} style={{padding: '0.5rem 0.75rem', fontWeight: 600}}>{h}</th>
                ))}
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

function DiscountRow({
  discount,
  defaultDiscount,
}: {
  discount: {shopify_product_id: string; discount_rate: number};
  defaultDiscount: number;
}) {
  const fetcher = useFetcher<ActionData>();
  const offPercent = Math.round((1 - discount.discount_rate) * 100);

  return (
    <tr style={{borderBottom: '1px solid #e0e0e0'}}>
      <td style={{padding: '0.75rem', fontFamily: 'monospace'}}>{discount.shopify_product_id}</td>
      <td style={{padding: '0.75rem'}}>
        <span style={{fontWeight: 600, color: offPercent > defaultDiscount ? '#dc2626' : '#2563eb'}}>
          {offPercent}% OFF
        </span>
        {offPercent !== defaultDiscount && (
          <span style={{fontSize: '0.75rem', color: '#888', marginLeft: '0.5rem'}}>
            （デフォルト: {defaultDiscount}%）
          </span>
        )}
      </td>
      <td style={{padding: '0.75rem'}}>
        <fetcher.Form
          method="post"
          onSubmit={(e) => {
            if (!confirm(`「${discount.shopify_product_id}」をデフォルト（${defaultDiscount}%OFF）に戻しますか？`))
              e.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="handle" value={discount.shopify_product_id} />
          <button
            type="submit"
            style={{
              padding: '0.25rem 0.75rem',
              border: '1px solid #ccc',
              borderRadius: 4,
              cursor: 'pointer',
              background: '#f5f5f5',
              fontSize: '0.875rem',
            }}
          >
            削除（デフォルトに戻す）
          </button>
        </fetcher.Form>
        {fetcher.data?.error && (
          <p style={{color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', marginBottom: 0}}>
            {fetcher.data.error}
          </p>
        )}
      </td>
    </tr>
  );
}
