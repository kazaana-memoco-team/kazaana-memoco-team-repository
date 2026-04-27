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
    supabase
      .from('companies')
      .select('id, name, member_limit')
      .eq('id', user.company_id)
      .single(),
    supabase
      .from('users')
      .select(
        'id, email, last_name, first_name, role, status, created_at, last_login_at',
      )
      .eq('company_id', user.company_id)
      .in('role', ['member', 'company_admin'])
      .neq('status', 'deleted')
      .order('created_at', {ascending: false}),
  ]);

  return {user, company, employees: employees ?? []};
}

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ActionData> {
  const user = await requireRole(request, context.env, ['company_admin', 'super_admin']);

  if (!user.company_id) return {error: '企業情報が見つかりません'};

  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');
  const supabase = createSupabaseAdmin(context.env);

  if (intent === 'invite') {
    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase();
    if (!email) return {error: 'メールアドレスを入力してください'};

    const {data: inviteData, error: inviteError} =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: {company_id: user.company_id, role: 'member'},
      });
    if (inviteError) return {error: inviteError.message};

    const {error: dbError} = await supabase.from('users').upsert(
      {
        id: inviteData.user.id,
        email,
        company_id: user.company_id,
        role: 'member',
        status: 'pending',
      },
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
  const slots =
    company?.member_limit != null ? company.member_limit - active : null;

  return (
    <div style={{maxWidth: 900, margin: '2rem auto', padding: '0 1rem'}}>
      <h1 style={{marginBottom: '1.5rem'}}>
        {company?.name ?? '企業'} ダッシュボード
      </h1>

      <dl style={{display: 'flex', gap: '1.5rem', marginBottom: '2rem'}}>
        <StatCard label="承認済み" value={active} />
        <StatCard label="招待中" value={pending} />
        {slots !== null && <StatCard label="残枠" value={slots} />}
      </dl>

      <section
        style={{
          marginBottom: '2rem',
          padding: '1rem 1.5rem',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
        }}
      >
        <h2 style={{marginTop: 0}}>従業員を招待</h2>
        <inviteFetcher.Form
          method="post"
          style={{display: 'flex', gap: '0.5rem'}}
        >
          <input type="hidden" name="intent" value="invite" />
          <input
            type="email"
            name="email"
            placeholder="メールアドレス"
            required
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              border: '1px solid #ccc',
              borderRadius: 4,
            }}
          />
          <button
            type="submit"
            disabled={inviteFetcher.state !== 'idle'}
            style={{
              padding: '0.5rem 1.25rem',
              background: '#222',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {inviteFetcher.state !== 'idle' ? '送信中...' : '招待メールを送信'}
          </button>
        </inviteFetcher.Form>
        {inviteFetcher.data?.error && (
          <p style={{color: '#dc2626', marginTop: '0.5rem', marginBottom: 0}}>
            {inviteFetcher.data.error}
          </p>
        )}
        {inviteFetcher.data?.success && (
          <p style={{color: '#16a34a', marginTop: '0.5rem', marginBottom: 0}}>
            {inviteFetcher.data.success}
          </p>
        )}
      </section>

      <section>
        <h2>従業員一覧</h2>
        {employees.length === 0 ? (
          <p>まだ従業員が登録されていません。上のフォームから招待してください。</p>
        ) : (
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{borderBottom: '2px solid #222', textAlign: 'left'}}>
                {['名前', 'メール', 'ステータス', '最終ログイン', '操作'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{padding: '0.5rem 0.75rem', fontWeight: 600}}
                    >
                      {h}
                    </th>
                  ),
                )}
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

function StatCard({label, value}: {label: string; value: number}) {
  return (
    <div
      style={{
        padding: '1rem 1.5rem',
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        minWidth: 100,
      }}
    >
      <dt style={{fontSize: '0.875rem', color: '#666'}}>{label}</dt>
      <dd style={{fontSize: '2rem', fontWeight: 'bold', margin: 0}}>
        {value}
      </dd>
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
    emp.last_name && emp.first_name
      ? `${emp.last_name} ${emp.first_name}`
      : '-';

  return (
    <tr style={{borderBottom: '1px solid #e0e0e0'}}>
      <td style={{padding: '0.75rem'}}>{name}</td>
      <td style={{padding: '0.75rem'}}>{emp.email}</td>
      <td style={{padding: '0.75rem'}}>
        {STATUS_LABEL[emp.status] ?? emp.status}
      </td>
      <td style={{padding: '0.75rem'}}>
        {emp.last_login_at
          ? new Date(emp.last_login_at).toLocaleDateString('ja-JP')
          : '-'}
      </td>
      <td style={{padding: '0.75rem'}}>
        <div style={{display: 'flex', gap: '0.5rem'}}>
          {emp.status === 'pending' && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="resend" />
              <input type="hidden" name="email" value={emp.email ?? ''} />
              <button type="submit" style={smallBtn}>
                再送信
              </button>
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
            <button
              type="submit"
              style={{...smallBtn, background: '#dc2626', color: '#fff', borderColor: '#dc2626'}}
            >
              削除
            </button>
          </fetcher.Form>
        </div>
        {fetcher.data?.error && (
          <p style={{color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', marginBottom: 0}}>
            {fetcher.data.error}
          </p>
        )}
        {fetcher.data?.success && (
          <p style={{color: '#16a34a', fontSize: '0.8rem', marginTop: '0.25rem', marginBottom: 0}}>
            {fetcher.data.success}
          </p>
        )}
      </td>
    </tr>
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
