import {useFetcher, useLoaderData} from 'react-router';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/mypage.family';

type ActionData = {error?: string; success?: string};

// 招待できる続柄（2親等以内）と親等。従業員が選択し、その記録を保管する。
// 自由入力を廃し選択式にすることで、無関係な他人の招待を抑止する（完全防止はギフトの性質上不可）。
const RELATIONSHIP_OPTIONS: {label: string; degree: number}[] = [
  {label: '配偶者', degree: 1},
  {label: '子', degree: 1},
  {label: '父・母', degree: 1},
  {label: '配偶者の父・母', degree: 1},
  {label: '兄弟・姉妹', degree: 2},
  {label: '祖父・祖母', degree: 2},
  {label: '孫', degree: 2},
  {label: '配偶者の祖父母・兄弟姉妹', degree: 2},
];
const RELATIONSHIP_DEGREE: Record<string, number> = Object.fromEntries(
  RELATIONSHIP_OPTIONS.map((o) => [o.label, o.degree]),
);

// 1従業員あたりの家族アカウント上限（悪用抑止。2親等以内の現実的な人数に余裕を持たせる）
const FAMILY_LIMIT_PER_EMPLOYEE = 15;

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
    if (!email) return {error: 'メールアドレスを入力してください'};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return {error: 'メールアドレスの形式が正しくありません'};
    }
    // 続柄は選択肢からのみ受け付ける（親等は続柄から自動決定し記録する）
    const kinshipDegree = RELATIONSHIP_DEGREE[relationship];
    if (!kinshipDegree) return {error: '続柄を選択してください（2親等以内の家族のみ招待できます）'};

    // 家族人数の上限チェック（悪用抑止）
    const {count: familyCount} = await supabase
      .from('users')
      .select('id', {count: 'exact', head: true})
      .eq('parent_user_id', user.id)
      .neq('status', 'deleted');
    if ((familyCount ?? 0) >= FAMILY_LIMIT_PER_EMPLOYEE) {
      return {
        error: `招待できる家族は最大${FAMILY_LIMIT_PER_EMPLOYEE}名までです。超える場合は運営にご相談ください。`,
      };
    }

    const origin = new URL(request.url).origin;
    const {data: inviteData, error: inviteError} = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: {role: 'family_member', parent_user_id: user.id},
        redirectTo: `${origin}/auth/confirm`,
      },
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
      <p style={{color: '#555', marginBottom: '0.5rem'}}>
        2親等以内のご家族を招待すると、独立したアカウントで会員価格での購入が可能になります。
        招待時に選択いただいた<strong>続柄は記録</strong>されます。
      </p>
      <p style={{color: '#a15', fontSize: '0.8125rem', marginBottom: '1.5rem'}}>
        ※ 会員規約により、ご利用は従業員ご本人と2親等以内のご家族に限られます。対象外の方のご利用が確認された場合、
        会員規約に基づき割引相当額のご請求等を行う場合があります。
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
            <label htmlFor="relationship">続柄（ご本人から見た関係）</label>
            <select
              id="relationship"
              name="relationship"
              required
              defaultValue=""
              className="form-input"
              style={{width: 200}}
            >
              <option value="" disabled>
                選択してください
              </option>
              {RELATIONSHIP_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>
                  {o.label}（{o.degree}親等）
                </option>
              ))}
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
