import {redirect} from 'react-router';
import {useFetcher, useLoaderData} from 'react-router';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/dashboard._index';

type ActionData = {error?: string; success?: string};

export async function loader({request, context}: Route.LoaderArgs) {
  const user = await requireRole(request, context.env, ['company_admin', 'super_admin']);
  const supabase = createSupabaseAdmin(context.env);

  if (!user.company_id) throw redirect('/');

  const [{data: company}, {data: employees}] = await Promise.all([
    supabase.from('companies').select('id, name, member_limit').eq('id', user.company_id).single(),
    supabase
      .from('users')
      .select('id, email, last_name, first_name, role, status, created_at, last_login_at')
      .eq('company_id', user.company_id)
      .in('role', ['member', 'company_admin'])
      .neq('status', 'deleted')
      .order('created_at', {ascending: false}),
  ]);

  return {user, company, employees: employees ?? []};
}

export async function action({request, context}: Route.ActionArgs): Promise<ActionData> {
  const user = await requireRole(request, context.env, ['company_admin', 'super_admin']);
  if (!user.company_id) return {error: '企業情報が見つかりません'};

  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');
  const supabase = createSupabaseAdmin(context.env);

  if (intent === 'invite') {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    if (!email) return {error: 'メールアドレスを入力してください'};
    const {data: inviteData, error: inviteError} = await supabase.auth.admin.inviteUserByEmail(
      email,
      {data: {company_id: user.company_id, role: 'member'}},
    );
    if (inviteError) return {error: inviteError.message};
    const {error: dbError} = await supabase.from('users').upsert(
      {id: inviteData.user.id, email, company_id: user.company_id, role: 'member', status: 'pending'},
      {onConflict: 'id'},
    );
    if (dbError) return {error: 'DBエラー: ' + dbError.message};
    return {success: `${email} に招待メールを送信しました`};
  }

  if (intent === 'resend') {
    const email = String(formData.get('email') ?? '').trim();
    const {error} = await supabase.auth.admin.inviteUserByEmail(email);
    if (error) return {error: error.message};
    return {success: `${email} に再送信しました`};
  }

  if (intent === 'delete') {
    const targetId = String(formData.get('userId') ?? '');
    const {error} = await supabase
      .from('users')
      .update({status: 'deleted', deleted_at: new Date().toISOString()})
      .eq('id', targetId)
      .eq('company_id', user.company_id);
    if (error) return {error: error.message};
    return {success: '削除しました'};
  }

  return {error: '不明な操作です'};
}

export default function DashboardPage() {
  const {company, employees} = useLoaderData<typeof loader>();
  const inviteFetcher = useFetcher<ActionData>();

  const active = employees.filter((e) => e.status === 'active').length;
  const pending = employees.filter((e) => e.status === 'pending').length;
  const slots = company?.member_limit != null ? company.member_limit - active : null;

  return (
    <div className="admin-page">
      <div className="page-heading">
        <h1>{company?.name ?? '企業'} ダッシュボード</h1>
      </div>

      <dl className="stat-cards">
        <div className="stat-card"><dt>承認済み</dt><dd>{active}</dd></div>
        <div className="stat-card"><dt>招待中</dt><dd>{pending}</dd></div>
        {slots !== null && <div className="stat-card"><dt>残枠</dt><dd>{slots}</dd></div>}
      </dl>

      <section className="admin-section">
        <h2>従業員を招待</h2>
        <inviteFetcher.Form method="post" className="form-row">
          <input type="hidden" name="intent" value="invite" />
          <div className="form-group">
            <label htmlFor="invite-email">メールアドレス</label>
            <input
              id="invite-email"
              type="email"
              name="email"
              placeholder="employee@example.com"
              required
              className="form-input"
              style={{width: 260}}
            />
          </div>
          <button type="submit" disabled={inviteFetcher.state !== 'idle'} className="btn-primary">
            {inviteFetcher.state !== 'idle' ? '送信中...' : '招待メールを送信'}
          </button>
        </inviteFetcher.Form>
        {inviteFetcher.data?.error && <p className="msg-error">{inviteFetcher.data.error}</p>}
        {inviteFetcher.data?.success && <p className="msg-success">{inviteFetcher.data.success}</p>}
      </section>

      <section>
        <h2>従業員一覧</h2>
        {employees.length === 0 ? (
          <p style={{color: '#666'}}>まだ従業員が登録されていません。上のフォームから招待してください。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {['名前', 'メール', 'ステータス', '最終ログイン', '操作'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <EmployeeRow key={emp.id} emp={emp} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: '承認済み',
  pending: '招待中',
  inactive: '停止中',
};

function EmployeeRow({emp}: {emp: Record<string, any>}) {
  const fetcher = useFetcher<ActionData>();
  const name =
    emp.last_name && emp.first_name ? `${emp.last_name} ${emp.first_name}` : '-';

  return (
    <tr>
      <td>{name}</td>
      <td>{emp.email}</td>
      <td>
        <span className={`badge ${emp.status === 'active' ? 'badge-active' : 'badge-pending'}`}>
          {STATUS_LABEL[emp.status] ?? emp.status}
        </span>
      </td>
      <td>{emp.last_login_at ? new Date(emp.last_login_at).toLocaleDateString('ja-JP') : '-'}</td>
      <td>
        <div style={{display: 'flex', gap: '0.5rem'}}>
          {emp.status === 'pending' && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="resend" />
              <input type="hidden" name="email" value={emp.email ?? ''} />
              <button type="submit" className="btn-sm">再送信</button>
            </fetcher.Form>
          )}
          <fetcher.Form
            method="post"
            onSubmit={(e) => {
              if (!confirm(`${name === '-' ? emp.email : name} を削除しますか？`))
                e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="userId" value={emp.id} />
            <button type="submit" className="btn-sm btn-danger">削除</button>
          </fetcher.Form>
        </div>
        {fetcher.data?.error && <p className="msg-error msg-sm">{fetcher.data.error}</p>}
        {fetcher.data?.success && <p className="msg-success msg-sm">{fetcher.data.success}</p>}
      </td>
    </tr>
  );
}
