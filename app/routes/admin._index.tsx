import {useFetcher, useLoaderData, Link} from 'react-router';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/admin._index';

type ActionData = {error?: string; success?: string};

export async function loader({request, context}: Route.LoaderArgs) {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);

  const [{data: companies}, {data: users}, {data: orders}] = await Promise.all([
    supabase.from('companies').select('id, name, member_limit, created_at').order('name'),
    supabase
      .from('users')
      .select('id, company_id, role, status, parent_user_id')
      .neq('status', 'deleted')
      .in('role', ['member', 'company_admin']),
    supabase.from('orders').select('id, company_id').eq('status', 'paid'),
  ]);

  const companyStats = (companies ?? []).map((c) => {
    const companyUsers = (users ?? []).filter(
      (u) => u.company_id === c.id && !u.parent_user_id,
    );
    return {
      ...c,
      activeCount: companyUsers.filter((u) => u.status === 'active').length,
      pendingCount: companyUsers.filter((u) => u.status === 'pending').length,
      orderCount: (orders ?? []).filter((o) => o.company_id === c.id).length,
    };
  });

  return {companyStats};
}

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ActionData> {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');

  if (intent === 'add') {
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return {error: '企業名を入力してください'};
    const limitRaw = formData.get('member_limit');
    const memberLimit =
      limitRaw && String(limitRaw).trim() !== '' ? Number(limitRaw) : null;
    const {error} = await supabase.from('companies').insert({name, member_limit: memberLimit});
    if (error) return {error: error.message};
    return {success: `「${name}」を追加しました`};
  }

  if (intent === 'update_limit') {
    const id = String(formData.get('id') ?? '');
    const limitRaw = formData.get('member_limit');
    const memberLimit =
      limitRaw && String(limitRaw).trim() !== '' ? Number(limitRaw) : null;
    const {error} = await supabase
      .from('companies')
      .update({member_limit: memberLimit})
      .eq('id', id);
    if (error) return {error: error.message};
    return {success: '会員枠を更新しました'};
  }

  if (intent === 'delete') {
    const id = String(formData.get('id') ?? '');
    await supabase.from('users').update({status: 'inactive'}).eq('company_id', id);
    const {error} = await supabase.from('companies').delete().eq('id', id);
    if (error) return {error: error.message};
    return {success: '企業を削除しました'};
  }

  return {error: '不明な操作です'};
}

export default function AdminPage() {
  const {companyStats} = useLoaderData<typeof loader>();
  const addFetcher = useFetcher<ActionData>();

  const totalActive = companyStats.reduce((s, c) => s + c.activeCount, 0);
  const totalPending = companyStats.reduce((s, c) => s + c.pendingCount, 0);
  const totalOrders = companyStats.reduce((s, c) => s + c.orderCount, 0);

  return (
    <div className="admin-page">
      <div className="page-heading">
        <h1>kazaana 運営管理</h1>
        <Link to="/admin/discounts" style={{fontSize: '0.875rem', color: '#2563eb'}}>
          商品別割引率の設定 →
        </Link>
      </div>

      <dl className="stat-cards">
        <div className="stat-card"><dt>企業数</dt><dd>{companyStats.length}</dd></div>
        <div className="stat-card"><dt>承認済み会員（合計）</dt><dd>{totalActive}</dd></div>
        <div className="stat-card"><dt>招待中（合計）</dt><dd>{totalPending}</dd></div>
        <div className="stat-card"><dt>購入件数（合計）</dt><dd>{totalOrders}</dd></div>
      </dl>

      <section className="admin-section">
        <h2>企業を追加</h2>
        <addFetcher.Form method="post" className="form-row">
          <input type="hidden" name="intent" value="add" />
          <div className="form-group">
            <label>企業名</label>
            <input type="text" name="name" required placeholder="株式会社〇〇" className="form-input" style={{width: 220}} />
          </div>
          <div className="form-group">
            <label>会員枠（空欄＝無制限）</label>
            <input type="number" name="member_limit" min="1" placeholder="例: 50" className="form-input" style={{width: 120}} />
          </div>
          <button type="submit" disabled={addFetcher.state !== 'idle'} className="btn-primary">
            追加
          </button>
        </addFetcher.Form>
        {addFetcher.data?.error && <p className="msg-error">{addFetcher.data.error}</p>}
        {addFetcher.data?.success && <p className="msg-success">{addFetcher.data.success}</p>}
      </section>

      <section>
        <h2>企業一覧</h2>
        {companyStats.length === 0 ? (
          <p style={{color: '#666'}}>企業が登録されていません。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {['企業名', '承認済み', '招待中', '購入件数', '会員枠', '操作'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companyStats.map((c) => (
                <CompanyRow key={c.id} company={c} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function CompanyRow({company}: {company: Record<string, any>}) {
  const fetcher = useFetcher<ActionData>();
  return (
    <tr>
      <td style={{fontWeight: 500}}>{company.name}</td>
      <td>{company.activeCount}</td>
      <td>{company.pendingCount}</td>
      <td>{company.orderCount}</td>
      <td>
        <fetcher.Form method="post" className="form-row" style={{gap: '0.4rem'}}>
          <input type="hidden" name="intent" value="update_limit" />
          <input type="hidden" name="id" value={company.id} />
          <input
            type="number"
            name="member_limit"
            min="1"
            defaultValue={company.member_limit ?? ''}
            placeholder="無制限"
            className="form-input"
            style={{width: 80, fontSize: '0.875rem'}}
          />
          <button type="submit" className="btn-sm">更新</button>
        </fetcher.Form>
        {fetcher.data?.success && fetcher.formData?.get('intent') === 'update_limit' && (
          <span className="msg-sm msg-success">✓</span>
        )}
      </td>
      <td>
        <fetcher.Form
          method="post"
          onSubmit={(e) => {
            if (!confirm(`「${company.name}」を削除しますか？\n所属会員は全員停止されます。`))
              e.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={company.id} />
          <button type="submit" className="btn-sm btn-danger">削除</button>
        </fetcher.Form>
        {fetcher.data?.error && <p className="msg-error msg-sm">{fetcher.data.error}</p>}
      </td>
    </tr>
  );
}
