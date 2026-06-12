import {useFetcher, useLoaderData, Link} from 'react-router';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import {clearExclusionCache} from '~/lib/exclusions';
import type {Route} from './+types/admin.exclusions';

type ActionData = {error?: string; success?: string};

export async function loader({request, context}: Route.LoaderArgs) {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);
  const {data: exclusions} = await supabase
    .from('product_exclusions')
    .select('product_handle, created_at')
    .order('created_at', {ascending: false});
  return {exclusions: exclusions ?? []};
}

export async function action({request, context}: Route.ActionArgs): Promise<ActionData> {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');
  const handle = String(formData.get('handle') ?? '').trim();

  if (!handle) return {error: '商品ハンドルを入力してください'};

  if (intent === 'exclude') {
    const {error} = await supabase
      .from('product_exclusions')
      .upsert({product_handle: handle}, {onConflict: 'product_handle'});
    if (error) return {error: error.message};
    clearExclusionCache();
    return {success: `「${handle}」を出品停止にしました（一覧・検索・商品ページに表示されません）`};
  }

  if (intent === 'include') {
    const {error} = await supabase
      .from('product_exclusions')
      .delete()
      .eq('product_handle', handle);
    if (error) return {error: error.message};
    clearExclusionCache();
    return {success: `「${handle}」の出品を再開しました`};
  }

  return {error: '不明な操作です'};
}

export default function AdminExclusionsPage() {
  const {exclusions} = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();

  return (
    <div className="admin-page">
      <div className="page-heading">
        <h1>出品管理（出品停止の設定）</h1>
        <Link to="/admin" style={{fontSize: '0.875rem', color: '#2563eb'}}>← 運営管理トップ</Link>
      </div>

      <p style={{color: '#555', marginBottom: '1rem'}}>
        BECOS-JP（Hydrogenチャネル）に公開されている商品は<strong>すべて自動で本サイトに出品</strong>されます。
        本サイトにだけ出したくない商品を、ここで出品停止にできます（最大60秒で反映）。
      </p>

      <div style={{background: '#fef9c3', border: '1px solid #fde047', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.875rem'}}>
        商品ハンドルは Shopify 管理画面 → 商品詳細 の URL 末尾（例:{' '}
        <code>thebecos.myshopify.com/products/<strong>s0111-462</strong></code>）で確認できます。
      </div>

      <section className="admin-section">
        <h2>出品停止にする</h2>
        <fetcher.Form method="post" className="form-row">
          <input type="hidden" name="intent" value="exclude" />
          <input
            type="text"
            name="handle"
            placeholder="商品ハンドル（例: s0111-462）"
            required
            style={{flex: 1}}
          />
          <button type="submit" disabled={fetcher.state !== 'idle'}>
            出品停止
          </button>
        </fetcher.Form>
        {fetcher.data?.error && (
          <p style={{color: '#dc2626', fontSize: '0.875rem'}}>{fetcher.data.error}</p>
        )}
        {fetcher.data?.success && (
          <p style={{color: '#16a34a', fontSize: '0.875rem'}}>{fetcher.data.success}</p>
        )}
      </section>

      <section className="admin-section">
        <h2>出品停止中の商品（{exclusions.length}件）</h2>
        {exclusions.length === 0 ? (
          <p style={{color: '#666'}}>出品停止中の商品はありません（全商品が出品されています）。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>商品ハンドル</th>
                <th>停止日</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exclusions.map((row) => (
                <tr key={row.product_handle}>
                  <td><code>{row.product_handle}</code></td>
                  <td>
                    {new Date(row.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td>
                    <fetcher.Form method="post" style={{display: 'inline'}}>
                      <input type="hidden" name="intent" value="include" />
                      <input type="hidden" name="handle" value={row.product_handle} />
                      <button type="submit" disabled={fetcher.state !== 'idle'}>
                        出品を再開
                      </button>
                    </fetcher.Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
