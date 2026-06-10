import {redirect, useLoaderData} from 'react-router';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import {DashboardNav} from '~/components/DashboardNav';
import type {Route} from './+types/dashboard.plan';

export const meta: Route.MetaFunction = () => [
  {title: 'ご契約内容 | JAPAN BENEFITS'},
];

export async function loader({request, context}: Route.LoaderArgs) {
  const user = await requireRole(request, context.env, ['company_admin', 'super_admin']);
  if (!user.company_id) throw redirect('/');
  const supabase = createSupabaseAdmin(context.env);

  // 契約カラム（plan_name等）未追加でも壊れないよう * で取得
  const [{data: company}, {count: memberCount}] = await Promise.all([
    supabase.from('companies').select('*').eq('id', user.company_id).single(),
    supabase
      .from('users')
      .select('id', {count: 'exact', head: true})
      .eq('company_id', user.company_id)
      .in('role', ['member', 'company_admin'])
      .neq('status', 'deleted'),
  ]);

  return {user, company, memberCount: memberCount ?? 0};
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function DashboardPlanPage() {
  const {user, company, memberCount} = useLoaderData<typeof loader>();
  const c = (company ?? {}) as Record<string, any>;

  const start = formatDate(c.contract_start);
  const end = formatDate(c.contract_end);
  const adminName =
    user.last_name && user.first_name
      ? `${user.last_name} ${user.first_name}`
      : user.email;

  return (
    <div className="admin-page">
      <div className="page-heading">
        <h1>ご契約内容</h1>
      </div>

      <DashboardNav current="plan" />

      <section className="admin-section">
        <p style={{fontWeight: 700, marginTop: 0}}>{c.name ?? '-'}</p>
        <dl className="plan-summary">
          <div>
            <dt>ご契約プラン</dt>
            <dd>{c.plan_name ?? '未設定（運営にお問い合わせください）'}</dd>
          </div>
          <div>
            <dt>契約期間</dt>
            <dd>
              {start && end ? (
                <>
                  {start} 〜 {end}
                  <span className="plan-note">※契約は自動更新となります</span>
                </>
              ) : (
                '未設定（運営にお問い合わせください）'
              )}
            </dd>
          </div>
          <div>
            <dt>登録従業員数 / 契約上限数</dt>
            <dd>
              <strong>{memberCount}</strong>
              {' / '}
              {c.member_limit != null ? `${c.member_limit}名` : '無制限'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="admin-section">
        <h2>企業情報</h2>
        <dl className="plan-summary">
          <div>
            <dt>社名</dt>
            <dd>{c.name ?? '-'}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-section">
        <h2>担当者情報</h2>
        <dl className="plan-summary">
          <div>
            <dt>名前</dt>
            <dd>{adminName}</dd>
          </div>
          <div>
            <dt>メールアドレス</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
      </section>

      <p style={{fontSize: '0.85rem', color: '#666'}}>
        プラン変更・契約に関するご相談は、運営（BECOS）までお問い合わせください。
      </p>
    </div>
  );
}
