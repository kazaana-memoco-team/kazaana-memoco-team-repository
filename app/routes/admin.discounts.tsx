import {useFetcher, useLoaderData, Link} from 'react-router';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import {DEFAULT_DISCOUNT} from '~/lib/pricing';
import {clearDiscountCache} from '~/lib/discounts';
import type {Route} from './+types/admin.discounts';

type ActionData = {error?: string; success?: string};

/** 個別設定済み商品の商品名を Shopify Admin から取得（表示用・失敗しても致命ではない） */
async function fetchTitles(
  env: Env,
  handles: string[],
): Promise<Record<string, string>> {
  const titles: Record<string, string> = {};
  if (handles.length === 0) return titles;
  try {
    const domain = env.SHOPIFY_STORE_DOMAIN || 'thebecos.myshopify.com';
    // handle:a OR handle:b ... で一括取得（100件まで）
    const query = handles
      .slice(0, 100)
      .map((h) => `handle:${h}`)
      .join(' OR ');
    const res = await fetch(
      `https://${domain}/admin/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          query: `{products(first:100, query:${JSON.stringify(query)}){nodes{handle title}}}`,
        }),
      },
    );
    const data = (await res.json()) as {
      data?: {products?: {nodes?: Array<{handle: string; title: string}>}};
    };
    for (const n of data.data?.products?.nodes ?? []) {
      titles[n.handle] = n.title;
    }
  } catch (e) {
    console.error('[admin.discounts] 商品名の取得に失敗:', e);
  }
  return titles;
}

export async function loader({request, context}: Route.LoaderArgs) {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);
  const {data: discounts} = await supabase
    .from('product_discounts')
    .select('shopify_product_id, discount_rate')
    .order('shopify_product_id');
  const rows = discounts ?? [];
  const titles = await fetchTitles(
    context.env,
    rows.map((d) => d.shopify_product_id),
  );
  return {
    discounts: rows,
    titles,
    defaultDiscount: Math.round((1 - DEFAULT_DISCOUNT) * 100),
  };
}

/** "%OFF" を 0<rate<1 の掛け率に変換。範囲外は null */
function percentToRate(percent: number): number | null {
  if (!Number.isFinite(percent) || percent < 1 || percent > 99) return null;
  return (100 - percent) / 100;
}

/** テキストエリアの入力をハンドル配列に正規化（改行/カンマ/空白区切り・重複除去） */
function parseHandles(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((h) => h.trim())
        .filter(Boolean),
    ),
  ];
}

export async function action({request, context}: Route.ActionArgs): Promise<ActionData> {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');

  if (intent === 'upsert') {
    const handle = String(formData.get('handle') ?? '').trim();
    const ratePercent = Number(formData.get('rate') ?? 0);
    const rate = percentToRate(ratePercent);
    if (!handle) return {error: '商品ハンドルを入力してください'};
    if (rate === null) return {error: '割引率は1〜99%で入力してください'};
    const {error} = await supabase
      .from('product_discounts')
      .upsert(
        {shopify_product_id: handle, discount_rate: rate},
        {onConflict: 'shopify_product_id'},
      );
    if (error) return {error: error.message};
    clearDiscountCache();
    return {success: `「${handle}」の割引率を ${ratePercent}%OFF に設定しました`};
  }

  if (intent === 'bulk_upsert') {
    const handles = parseHandles(String(formData.get('handles') ?? ''));
    const ratePercent = Number(formData.get('rate') ?? 0);
    const rate = percentToRate(ratePercent);
    if (handles.length === 0) return {error: '商品ハンドルを1つ以上入力してください'};
    if (rate === null) return {error: '割引率は1〜99%で入力してください'};
    const {error} = await supabase.from('product_discounts').upsert(
      handles.map((h) => ({shopify_product_id: h, discount_rate: rate})),
      {onConflict: 'shopify_product_id'},
    );
    if (error) return {error: error.message};
    clearDiscountCache();
    return {
      success: `${handles.length}件の商品を ${ratePercent}%OFF に一括設定しました`,
    };
  }

  if (intent === 'delete') {
    const handle = String(formData.get('handle') ?? '');
    const {error} = await supabase
      .from('product_discounts')
      .delete()
      .eq('shopify_product_id', handle);
    if (error) return {error: error.message};
    clearDiscountCache();
    return {success: `「${handle}」をデフォルト割引率に戻しました`};
  }

  if (intent === 'bulk_clear') {
    // 全ての個別設定を削除（全商品をデフォルト割引率に戻す）
    const {error} = await supabase
      .from('product_discounts')
      .delete()
      .neq('shopify_product_id', '');
    if (error) return {error: error.message};
    clearDiscountCache();
    return {success: 'すべての個別設定を解除し、全商品をデフォルト割引率に戻しました'};
  }

  return {error: '不明な操作です'};
}

export default function AdminDiscountsPage() {
  const {discounts, titles, defaultDiscount} = useLoaderData<typeof loader>();
  const upsertFetcher = useFetcher<ActionData>();
  const bulkFetcher = useFetcher<ActionData>();
  const clearFetcher = useFetcher<ActionData>();

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

      {/* 個別設定 */}
      <section className="admin-section">
        <h2>1件ずつ設定・変更</h2>
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

      {/* 一括設定 */}
      <section className="admin-section">
        <h2>まとめて設定（一括変更）</h2>
        <p style={{color: '#555', fontSize: '0.875rem', margin: '0 0 0.75rem'}}>
          複数の商品ハンドルを改行・カンマ・スペース区切りで貼り付け、同じ割引率を一括適用します。
        </p>
        <bulkFetcher.Form method="post">
          <input type="hidden" name="intent" value="bulk_upsert" />
          <div className="form-group" style={{marginBottom: '0.75rem'}}>
            <label htmlFor="handles">商品ハンドル（複数）</label>
            <textarea
              id="handles"
              name="handles"
              required
              rows={5}
              placeholder={'s0111-462\ns0009-115\ns0043-117'}
              className="form-input"
              style={{width: '100%', maxWidth: 460, fontFamily: 'monospace', display: 'block'}}
            />
          </div>
          <div style={{display: 'flex', alignItems: 'flex-end', gap: '0.75rem'}}>
            <div className="form-group">
              <label htmlFor="bulk-rate">割引率（%OFF）</label>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                <input id="bulk-rate" type="number" name="rate" required min="1" max="99" placeholder="40" className="form-input" style={{width: 70}} />
                <span style={{fontSize: '0.875rem'}}>% OFF</span>
              </div>
            </div>
            <button type="submit" disabled={bulkFetcher.state !== 'idle'} className="btn-primary">
              一括設定
            </button>
          </div>
        </bulkFetcher.Form>
        {bulkFetcher.data?.error && <p className="msg-error">{bulkFetcher.data.error}</p>}
        {bulkFetcher.data?.success && <p className="msg-success">{bulkFetcher.data.success}</p>}
      </section>

      {/* 個別設定済み一覧 */}
      <section>
        <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem'}}>
          <h2>個別設定済み商品（{discounts.length}件）</h2>
          {discounts.length > 0 && (
            <clearFetcher.Form
              method="post"
              onSubmit={(e) => {
                if (!confirm(`個別設定 ${discounts.length}件 をすべて解除し、全商品をデフォルト（${defaultDiscount}%OFF）に戻しますか？`))
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="intent" value="bulk_clear" />
              <button type="submit" className="btn-sm" disabled={clearFetcher.state !== 'idle'}>
                すべて解除（デフォルトに戻す）
              </button>
            </clearFetcher.Form>
          )}
        </div>
        {clearFetcher.data?.error && <p className="msg-error">{clearFetcher.data.error}</p>}
        {clearFetcher.data?.success && <p className="msg-success">{clearFetcher.data.success}</p>}
        {discounts.length === 0 ? (
          <p style={{color: '#666'}}>個別設定なし（全商品 {defaultDiscount}%OFF）</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>商品</th>
                <th>割引率</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <DiscountRow
                  key={d.shopify_product_id}
                  discount={d}
                  title={titles[d.shopify_product_id]}
                  defaultDiscount={defaultDiscount}
                />
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
  title,
  defaultDiscount,
}: {
  discount: {shopify_product_id: string; discount_rate: number};
  title?: string;
  defaultDiscount: number;
}) {
  const fetcher = useFetcher<ActionData>();
  const offPercent = Math.round((1 - discount.discount_rate) * 100);
  return (
    <tr>
      <td>
        {title && <div style={{fontSize: '0.9rem'}}>{title}</div>}
        <code style={{fontSize: '0.75rem', color: '#888'}}>{discount.shopify_product_id}</code>
      </td>
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
