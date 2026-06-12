import {useFetcher, useLoaderData, Link} from 'react-router';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/admin.contracts';

type ActionData = {error?: string; success?: string};

// プラン → 従業員上限の対応（freee請求の根拠・/dashboard/plan表示用）
const PLAN_LIMITS: Record<string, number | null> = {
  S: 30,
  M: 100,
  L: 300,
  XL: null,
};

export async function loader({request, context}: Route.LoaderArgs) {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);
  const {data: companies} = await supabase
    .from('companies')
    .select('id, name, plan_name, member_limit, contract_start, contract_end')
    .order('created_at', {ascending: false});
  return {companies: companies ?? []};
}

export async function action({request, context}: Route.ActionArgs): Promise<ActionData> {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);
  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  const plan = String(form.get('plan_name') ?? '').trim();
  const start = String(form.get('contract_start') ?? '').trim();
  const end = String(form.get('contract_end') ?? '').trim();

  if (!id) return {error: '企業が特定できません'};

  const update: Record<string, unknown> = {
    plan_name: plan || null,
    contract_start: start || null,
    contract_end: end || null,
  };
  // プランが選ばれていれば従業員上限を自動設定
  if (plan && plan in PLAN_LIMITS) {
    update.member_limit = PLAN_LIMITS[plan];
  }

  const {error} = await supabase.from('companies').update(update).eq('id', id);
  if (error) return {error: error.message};
  return {success: '契約情報を保存しました'};
}

export default function AdminContractsPage() {
  const {companies} = useLoaderData<typeof loader>();

  return (
    <div className="admin-page">
      <div className="page-heading">
        <h1>契約情報の管理</h1>
        <Link to="/admin" style={{fontSize: '0.875rem', color: '#2563eb'}}>
          ← 運営管理トップ
        </Link>
      </div>

      <p style={{color: '#555', marginBottom: '1rem'}}>
        freeeで請求書を発行した契約企業の<strong>プラン・契約期間</strong>を登録します。
        登録すると、企業の管理画面（ご契約内容）に反映され、ファウンディング残枠の計算にも使われます。
        請求書の発行・入金管理は freee 側で行ってください。
      </p>

      <div style={{background: '#fef9c3', border: '1px solid #fde047', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.875rem'}}>
        プラン: S（〜30名/月19,800円）・M（〜100名/月39,800円）・L（〜300名/月79,800円）・XL（301名〜/個別）。
        いずれも年間一括前払い（税抜）。プランを選ぶと従業員上限が自動設定されます。
      </div>

      {companies.length === 0 ? (
        <p style={{color: '#666'}}>登録された契約企業がありません。</p>
      ) : (
        companies.map((c) => <CompanyRow key={c.id} company={c} />)
      )}
    </div>
  );
}

function CompanyRow({company}: {company: Record<string, any>}) {
  const fetcher = useFetcher<ActionData>();
  return (
    <section className="admin-section">
      <h2 style={{marginBottom: '0.5rem'}}>{company.name}</h2>
      <fetcher.Form method="post" className="contract-form">
        <input type="hidden" name="id" value={company.id} />
        <div className="contract-grid">
          <label>
            プラン
            <select name="plan_name" defaultValue={company.plan_name ?? ''}>
              <option value="">未設定</option>
              <option value="S">S（〜30名）</option>
              <option value="M">M（〜100名）</option>
              <option value="L">L（〜300名）</option>
              <option value="XL">XL（301名〜）</option>
            </select>
          </label>
          <label>
            契約開始日
            <input
              type="date"
              name="contract_start"
              defaultValue={company.contract_start ?? ''}
            />
          </label>
          <label>
            契約終了日
            <input
              type="date"
              name="contract_end"
              defaultValue={company.contract_end ?? ''}
            />
          </label>
          <button type="submit" disabled={fetcher.state !== 'idle'}>
            保存
          </button>
        </div>
        {fetcher.data?.error && (
          <p style={{color: '#dc2626', fontSize: '0.875rem', margin: '0.5rem 0 0'}}>
            {fetcher.data.error}
          </p>
        )}
        {fetcher.data?.success && (
          <p style={{color: '#16a34a', fontSize: '0.875rem', margin: '0.5rem 0 0'}}>
            {fetcher.data.success}
          </p>
        )}
      </fetcher.Form>
      <p style={{fontSize: '0.8125rem', color: '#6b7280', margin: '0.5rem 0 0'}}>
        現在: プラン {company.plan_name ?? '未設定'} ／ 従業員上限{' '}
        {company.member_limit ?? '—'} ／ 期間{' '}
        {company.contract_start ?? '—'} 〜 {company.contract_end ?? '—'}
      </p>
    </section>
  );
}
