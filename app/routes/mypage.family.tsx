import {useFetcher, useLoaderData} from 'react-router';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/mypage.family';

type ActionData = {error?: string; success?: string};

export async function loader({request, context}: Route.LoaderArgs) {
  const user = await requireRole(request, context.env, ['member', 'company_admin', 'super_admin']);
  const supabase = createSupabaseAdmin(context.env);

  const {data: familyMembers} = await supabase
    .from('users')
    .select('id, email, last_name, first_name, relationship, status, created_at, last_login_at')
    .eq('parent_user_id', user.id)
    .neq('status', 'deleted')
    .order('created_at', {ascending: false});

  return {user, familyMembers: familyMembers ?? []};
}

export async function action({request, context}: Route.ActionArgs): Promise<ActionData> {
  const user = await requireRole(request, context.env, ['member', 'company_admin', 'super_admin']);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');
  const supabase = createSupabaseAdmin(context.env);

  if (intent === 'invite') {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const relationship = String(formData.get('relationship') ?? '').trim();
    const kinshipDegree = Number(formData.get('kinship_degree') ?? 0);
    if (!email) return {error: 'メールアドレスを入力してください'};
    if (!relationship) return {error: '続柄を入力してください'};
    if (kinshipDegree < 1 || kinshipDegree > 2) return {error: '2親等以内の家族のみ招待できます'};

    const {data: inviteData, error: inviteError} = await supabase.auth.admin.inviteUserByEmail(
      email,
      {data: {role: 'family_member', parent_user_id: user.id}},
    );
    if (inviteError) return {error: inviteError.message};

    const {error: dbError} = await supabase.from('users').upsert(
      {
        id: inviteData.user.id,
        email,
        company_id: user.company_id,
        role: 'family_member',
        status: 'pending',
        parent_user_id: user.id,
        relationship,
        kinship_degree: kinshipDegree,
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
      .eq('parent_user_id', user.id);
    if (error) return {error: error.message};
    return {success: '削除しました'};
  }

  return {error: '不明な操作です'};
}

export default function MypageFamilyPage() {
  const {familyMembers} = useLoaderData<typeof loader>();
  const inviteFetcher = useFetcher<ActionData>();

  return (
    <div className="mypage-page">
      <div className="page-heading">
        <h1>家族アカウント管理</h1>
      </div>
      <p style={{color: '#555', marginBottom: '1.5rem'}}>
        2親等以内の家族を招待すると、独立したアカウントで会員価格での購入が可能になります。
      </p>

      <section className="admin-section">
        <h2>家族を招待</h2>
        <inviteFetcher.Form method="post" className="form-row">
          <input type="hidden" name="intent" value="invite" />
          <div className="form-group">
            <label htmlFor="fam-email">メールアドレス</label>
            <input
              id="fam-email"
              type="email"
              name="email"
              placeholder="family@example.com"
              required
              className="form-input"
              style={{width: 220}}
            />
          </div>
          <div className="form-group">
            <label htmlFor="relationship">続柄</label>
            <input
              id="relationship"
              type="text"
              name="relationship"
              placeholder="例: 配偶者・子・親"
              required
              className="form-input"
              style={{width: 140}}
            />
          </div>
          <div className="form-group">
            <label htmlFor="kinship_degree">親等</label>
            <select
              id="kinship_degree"
              name="kinship_degree"
              required
              className="form-input"
              style={{width: 90}}
            >
              <option value="1">1親等</option>
              <option value="2">2親等</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviteFetcher.state !== 'idle'}
            className="btn-primary"
          >
            {inviteFetcher.state !== 'idle' ? '送信中...' : '招待'}
          </button>
        </inviteFetcher.Form>
        {inviteFetcher.data?.error && <p className="msg-error">{inviteFetcher.data.error}</p>}
        {inviteFetcher.data?.success && <p className="msg-success">{inviteFetcher.data.success}</p>}
      </section>

      <section>
        <h2>家族アカウント一覧</h2>
        {familyMembers.length === 0 ? (
          <p style={{color: '#666'}}>まだ家族アカウントが登録されていません。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {['名前', 'メール', '続柄', 'ステータス', '最終ログイン', '操作'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {familyMembers.map((member) => (
                <FamilyRow key={member.id} member={member} />
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

function FamilyRow({member}: {member: Record<string, any>}) {
  const fetcher = useFetcher<ActionData>();
  const name =
    member.last_name && member.first_name
      ? `${member.last_name} ${member.first_name}`
      : '-';

  return (
    <tr>
      <td>{name}</td>
      <td>{member.email}</td>
      <td>{member.relationship ?? '-'}</td>
      <td>
        <span className={`badge ${member.status === 'active' ? 'badge-active' : 'badge-pending'}`}>
          {STATUS_LABEL[member.status] ?? member.status}
        </span>
      </td>
      <td>
        {member.last_login_at
          ? new Date(member.last_login_at).toLocaleDateString('ja-JP')
          : '-'}
      </td>
      <td>
        <div style={{display: 'flex', gap: '0.5rem'}}>
          {member.status === 'pending' && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="resend" />
              <input type="hidden" name="email" value={member.email ?? ''} />
              <button type="submit" className="btn-sm">再送信</button>
            </fetcher.Form>
          )}
          <fetcher.Form
            method="post"
            onSubmit={(e) => {
              if (!confirm(`${name === '-' ? member.email : name} のアカウントを削除しますか？`))
                e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="userId" value={member.id} />
            <button type="submit" className="btn-sm btn-danger">削除</button>
          </fetcher.Form>
        </div>
        {fetcher.data?.error && <p className="msg-error msg-sm">{fetcher.data.error}</p>}
        {fetcher.data?.success && <p className="msg-success msg-sm">{fetcher.data.success}</p>}
      </td>
    </tr>
  );
}
