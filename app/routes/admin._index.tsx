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
    supabase
      .from('orders')
      .select('id, company_id')
      .eq('status', 'paid'),
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
      limitRaw && String(limitRaw).trim() !== ''
        ? Number(limitRaw)
        : null;

    const {error} = await supabase
      .from('companies')
      .insert({name, member_limit: memberLimit});
    if (error) return {error: error.message};
    return {success: `「${name}」を追加しました`};
  }

  if (intent === 'update_limit') {
    const id = String(formData.get('id') ?? '');
    const limitRaw = formData.get('member_limit');
    const memberLimit =
      limitRaw && String(limitRaw).trim() !== ''
        ? Number(limitRaw)
        : null;

    const {error} = await supabase
      .from('companies')
      .update({member_limit: memberLimit})
      .eq('id', id);
    if (error) return {error: error.message};
    return {success: '会員枠を更新しました'};
  }

  if (intent === 'delete') {
    const id = String(formData.get('id') ?? '');
    // 所属ユーザーを inactive に
    await supabase
      .from('users')
      .update({status: 'inactive'})
      .eq('company_id', id);
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
    <div style={{maxWidth: 1000, margin: '2rem auto', padding: '0 1rem'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem'}}>
        <h1 style={{margin: 0}}>kazaana 運営管理</h1>
        <Link to="/admin/discounts" style={{fontSize: '0.875rem', color: '#2563eb'}}>
          商品別割引率の設定 →
        </Link>
      </div>

      {/* 全社サマリー */}
      <dl style={{display: 'flex', gap: '1.5rem', marginBottom: '2rem'}}>
        <StatCard label="企業数" value={companyStats.length} />
        <StatCard label="承認済み会員（合計）" value={totalActive} />
        <StatCard label="招待中（合計）" value={totalPending} />
        <StatCard label="購入件数（合計）" value={totalOrders} />
      </dl>

      {/* 企業追加フォーム */}
      <section style={{marginBottom: '2rem', padding: '1rem 1.5rem', border: '1px solid #e0e0e0', borderRadius: 8}}>
        <h2 style={{marginTop: 0}}>企業を追加</h2>
        <addFetcher.Form method="post" style={{display: 'flex', gap: '0.5rem', alignItems: 'flex-end'}}>
          <input type="hidden" name="intent" value="add" />
          <div>
            <label style={{display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem'}}>
              企業名
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="株式会社〇〇"
              style={{padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, width: 220}}
            />
          </div>
          <div>
            <label style={{display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem'}}>
              会員枠（空欄＝無制限）
            </label>
            <input
              type="number"
              name="member_limit"
              min="1"
              placeholder="例: 50"
              style={{padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, width: 120}}
            />
          </div>
          <button
            type="submit"
            disabled={addFetcher.state !== 'idle'}
            style={{padding: '0.5rem 1.25rem', background: '#222', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer'}}
          >
            追加
          </button>
        </addFetcher.Form>
        {addFetcher.data?.error && (
          <p style={{color: '#dc2626', marginTop: '0.5rem', marginBottom: 0}}>{addFetcher.data.error}</p>
        )}
        {addFetcher.data?.success && (
          <p style={{color: '#16a34a', marginTop: '0.5rem', marginBottom: 0}}>{addFetcher.data.success}</p>
        )}
      </section>

      {/* 企業一覧 */}
      <section>
        <h2>企業一覧</h2>
        {companyStats.length === 0 ? (
          <p style={{color: '#666'}}>企業が登録されていません。</p>
        ) : (
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{borderBottom: '2px solid #222', textAlign: 'left'}}>
                {['企業名', '承認済み', '招待中', '購入件数', '会員枠', '操作'].map((h) => (
                  <th key={h} style={{padding: '0.5rem 0.75rem', fontWeight: 600}}>{h}</th>
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
    <tr style={{borderBottom: '1px solid #e0e0e0'}}>
      <td style={{padding: '0.75rem', fontWeight: 500}}>{company.name}</td>
      <td style={{padding: '0.75rem'}}>{company.activeCount}</td>
      <td style={{padding: '0.75rem'}}>{company.pendingCount}</td>
      <td style={{padding: '0.75rem'}}>{company.orderCount}</td>
      <td style={{padding: '0.75rem'}}>
        {/* 会員枠インライン編集 */}
        <fetcher.Form method="post" style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
          <input type="hidden" name="intent" value="update_limit" />
          <input type="hidden" name="id" value={company.id} />
          <input
            type="number"
            name="member_limit"
            min="1"
            defaultValue={company.member_limit ?? ''}
            placeholder="無制限"
            style={{width: 80, padding: '0.25rem 0.5rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.875rem'}}
          />
          <button type="submit" style={smallBtn}>更新</button>
        </fetcher.Form>
        {fetcher.data?.success && fetcher.formData?.get('intent') === 'update_limit' && (
          <span style={{fontSize: '0.75rem', color: '#16a34a'}}>✓</span>
        )}
      </td>
      <td style={{padding: '0.75rem'}}>
        <fetcher.Form
          method="post"
          onSubmit={(e) => {
            if (!confirm(`「${company.name}」を削除しますか？\n所属会員は全員停止されます。`))
              e.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={company.id} />
          <button
            type="submit"
            style={{...smallBtn, background: '#dc2626', color: '#fff', borderColor: '#dc2626'}}
          >
            削除
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

function StatCard({label, value}: {label: string; value: number}) {
  return (
    <div style={{padding: '1rem 1.5rem', border: '1px solid #e0e0e0', borderRadius: 8, minWidth: 120}}>
      <dt style={{fontSize: '0.8rem', color: '#666'}}>{label}</dt>
      <dd style={{fontSize: '1.75rem', fontWeight: 'bold', margin: 0}}>{value}</dd>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  padding: '0.25rem 0.75rem',
  border: '1px solid #ccc',
  borderRadius: 4,
  cursor: 'pointer',
  background: '#f5f5f5',
  fontSize: '0.875rem',
};
