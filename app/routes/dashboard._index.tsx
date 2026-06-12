import {redirect} from 'react-router';
import {useFetcher, useLoaderData} from 'react-router';
import {useState} from 'react';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import {DashboardNav} from '~/components/DashboardNav';
import type {Route} from './+types/dashboard._index';

type ActionData = {error?: string; success?: string};

// 直近アクセス率の定義: 過去60日（2ヶ月）以内にログイン（RWと同基準）
const RECENT_DAYS = 60;
const BULK_INVITE_LIMIT = 100;

const CSV_TEMPLATE_HREF =
  'data:text/csv;charset=utf-8,' +
  encodeURIComponent('email\ntaro.yamada@example.com\nhanako.sato@example.com\n');

export async function loader({request, context}: Route.LoaderArgs) {
  const user = await requireRole(request, context.env, ['company_admin', 'super_admin']);
  const supabase = createSupabaseAdmin(context.env);

  if (!user.company_id) throw redirect('/');

  const [{data: company}, {data: employees}, {data: orders}] = await Promise.all([
    supabase.from('companies').select('*').eq('id', user.company_id).single(),
    supabase
      .from('users')
      .select('id, email, last_name, first_name, role, status, created_at, last_login_at')
      .eq('company_id', user.company_id)
      .in('role', ['member', 'company_admin'])
      .neq('status', 'deleted')
      .order('created_at', {ascending: false}),
    supabase
      .from('orders')
      .select('user_id, total_regular_price, total_member_price')
      .eq('company_id', user.company_id)
      .eq('status', 'paid'),
  ]);

  return {user, company, employees: employees ?? [], orders: orders ?? []};
}

export async function action({request, context}: Route.ActionArgs): Promise<ActionData> {
  const user = await requireRole(request, context.env, ['company_admin', 'super_admin']);
  if (!user.company_id) return {error: '企業情報が見つかりません'};

  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');
  const supabase = createSupabaseAdmin(context.env);
  const origin = new URL(request.url).origin;

  const inviteOne = async (email: string): Promise<string | null> => {
    const {data: inviteData, error: inviteError} =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: {company_id: user.company_id, role: 'member'},
        redirectTo: `${origin}/auth/confirm`,
      });
    if (inviteError || !inviteData?.user) return inviteError?.message ?? '招待に失敗しました';
    const {error: dbError} = await supabase.from('users').upsert(
      {id: inviteData.user.id, email, company_id: user.company_id, role: 'member', status: 'pending'},
      {onConflict: 'id'},
    );
    return dbError ? 'DBエラー: ' + dbError.message : null;
  };

  if (intent === 'invite') {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    if (!email) return {error: 'メールアドレスを入力してください'};
    const err = await inviteOne(email);
    return err ? {error: err} : {success: `${email} に招待メールを送信しました`};
  }

  if (intent === 'bulk_invite') {
    const file = formData.get('csv');
    if (!(file instanceof File) || file.size === 0) {
      return {error: 'CSVファイルを選択してください'};
    }
    const text = await file.text();
    const emails = [
      ...new Set(
        text
          .split(/\r?\n/)
          .map((line) => line.split(',')[0]?.trim().toLowerCase() ?? '')
          .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
      ),
    ];
    if (emails.length === 0) {
      return {error: 'CSVに有効なメールアドレスが見つかりません（1列目にメールアドレスを入れてください）'};
    }
    if (emails.length > BULK_INVITE_LIMIT) {
      return {error: `一度に招待できるのは ${BULK_INVITE_LIMIT} 件までです（${emails.length}件検出）`};
    }

    // 会員枠チェック
    const {data: company} = await supabase
      .from('companies')
      .select('member_limit')
      .eq('id', user.company_id)
      .single();
    if (company?.member_limit != null) {
      const {count} = await supabase
        .from('users')
        .select('id', {count: 'exact', head: true})
        .eq('company_id', user.company_id)
        .in('role', ['member', 'company_admin'])
        .neq('status', 'deleted');
      if ((count ?? 0) + emails.length > company.member_limit) {
        return {
          error: `契約上限（${company.member_limit}名）を超えます。現在${count}名 + 招待${emails.length}件。プラン変更は運営にご相談ください`,
        };
      }
    }

    let ok = 0;
    const failed: string[] = [];
    for (const email of emails) {
      const err = await inviteOne(email);
      if (err) failed.push(email);
      else ok++;
    }
    const failNote =
      failed.length > 0
        ? `／ 失敗 ${failed.length}件（${failed.slice(0, 5).join(', ')}${failed.length > 5 ? ' 他' : ''}）※登録済みの可能性`
        : '';
    return {success: `CSV一括招待: ${ok}件に送信しました ${failNote}`};
  }

  if (intent === 'resend') {
    const email = String(formData.get('email') ?? '').trim();
    const {error} = await supabase.auth.admin.inviteUserByEmail(email);
    if (error) return {error: error.message};
    return {success: `${email} に再送信しました`};
  }

  if (intent === 'resend_all') {
    const {data: pendings} = await supabase
      .from('users')
      .select('email')
      .eq('company_id', user.company_id)
      .eq('status', 'pending')
      .in('role', ['member', 'company_admin']);
    if (!pendings?.length) return {error: '未登録の従業員はいません'};
    let ok = 0;
    for (const p of pendings) {
      if (!p.email) continue;
      const {error} = await supabase.auth.admin.inviteUserByEmail(p.email);
      if (!error) ok++;
    }
    return {success: `未登録 ${pendings.length}名のうち ${ok}名に招待メールを再送しました`};
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
  const {company, employees, orders} = useLoaderData<typeof loader>();
  const inviteFetcher = useFetcher<ActionData>();
  const csvFetcher = useFetcher<ActionData>();
  const resendAllFetcher = useFetcher<ActionData>();
  const [tab, setTab] = useState<'registered' | 'pending'>('registered');

  const active = employees.filter((e) => e.status === 'active');
  const pending = employees.filter((e) => e.status === 'pending');
  const registered = employees.filter((e) => e.status !== 'pending');

  // KPI（RW流: 登録率・直近アクセス率 ＋ JB独自: 合計節約額）
  const registrationRate =
    employees.length > 0 ? Math.round((active.length / employees.length) * 100) : 0;
  const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recentActive = active.filter(
    (e) => e.last_login_at && new Date(e.last_login_at).getTime() >= recentCutoff,
  );
  const accessRate =
    active.length > 0 ? Math.round((recentActive.length / active.length) * 100) : 0;
  // 規約v2 第7条: 企業全体の集計値（総注文数・総購入金額・総割引額）は開示可
  const totalOrders = orders.length;
  const totalPurchase = orders.reduce(
    (sum, o) => sum + (o.total_member_price ?? 0),
    0,
  );
  const totalSavings = orders.reduce(
    (sum, o) =>
      sum + Math.max(0, (o.total_regular_price ?? 0) - (o.total_member_price ?? 0)),
    0,
  );

  // 従業員ごとの利用実績（規約v2 第7条: 個人別は「注文回数」のみ。
  // 個人の購入金額・割引額は企業に開示しないため集計しない）
  const statsByUser = new Map<string, {count: number}>();
  for (const o of orders) {
    if (!o.user_id) continue;
    const s = statsByUser.get(o.user_id) ?? {count: 0};
    s.count += 1;
    statsByUser.set(o.user_id, s);
  }

  const visibleEmployees = tab === 'registered' ? registered : pending;

  return (
    <div className="admin-page">
      <div className="page-heading">
        <h1>{company?.name ?? '企業'} 管理画面</h1>
      </div>

      <DashboardNav current="users" />

      <dl className="stat-cards">
        <div className="stat-card">
          <dt>登録率</dt>
          <dd>{registrationRate}%</dd>
        </div>
        <div className="stat-card">
          <dt>
            直近アクセス率<span className="stat-note">※</span>
          </dt>
          <dd>{accessRate}%</dd>
        </div>
        <div className="stat-card">
          <dt>総注文数</dt>
          <dd>{totalOrders}件</dd>
        </div>
        <div className="stat-card">
          <dt>総購入金額</dt>
          <dd>¥{totalPurchase.toLocaleString('ja-JP')}</dd>
        </div>
        <div className="stat-card stat-card-highlight">
          <dt>従業員の合計割引額</dt>
          <dd>¥{totalSavings.toLocaleString('ja-JP')}</dd>
        </div>
      </dl>
      <p className="stat-footnote">
        ※ 過去{RECENT_DAYS}日以内にログインした登録済み会員の割合。
        金額はいずれも貴社全体の合計です（個人ごとの購入金額・商品は表示されません）。
      </p>

      <section className="admin-section">
        <h2>従業員を招待</h2>

        <p className="invite-subhead">■ 個人へ送信</p>
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

        <p className="invite-subhead" style={{marginTop: '1.5rem'}}>
          ■ 複数人へ送信（CSV一括）
        </p>
        <csvFetcher.Form method="post" encType="multipart/form-data" className="form-row">
          <input type="hidden" name="intent" value="bulk_invite" />
          <div className="form-group">
            <label htmlFor="invite-csv">CSVファイル</label>
            <input id="invite-csv" type="file" name="csv" accept=".csv,text/csv" required className="form-input" />
          </div>
          <button type="submit" disabled={csvFetcher.state !== 'idle'} className="btn-primary">
            {csvFetcher.state !== 'idle' ? '送信中...' : '一括招待を送信'}
          </button>
        </csvFetcher.Form>
        <ol className="csv-help">
          <li>
            <a href={CSV_TEMPLATE_HREF} download="japan-benefits-invite-template.csv">
              CSVテンプレートをダウンロード
            </a>
            してお使いください。
          </li>
          <li>1列目に招待したい従業員のメールアドレスを入力してアップロードしてください（最大{BULK_INVITE_LIMIT}件）。</li>
          <li>アップロードすると、記載されたメールアドレスに招待メールが届きます。</li>
        </ol>
        {csvFetcher.data?.error && <p className="msg-error">{csvFetcher.data.error}</p>}
        {csvFetcher.data?.success && <p className="msg-success">{csvFetcher.data.success}</p>}
      </section>

      <section>
        <div className="page-heading" style={{marginBottom: '0.5rem'}}>
          <h2 style={{margin: 0}}>従業員一覧</h2>
          {pending.length > 0 && (
            <resendAllFetcher.Form
              method="post"
              onSubmit={(e) => {
                if (!confirm(`未登録 ${pending.length}名へ招待メールを一括再送しますか？`))
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="intent" value="resend_all" />
              <button
                type="submit"
                disabled={resendAllFetcher.state !== 'idle'}
                className="btn-sm"
              >
                {resendAllFetcher.state !== 'idle' ? '送信中...' : '未登録者へ招待メール一括再送'}
              </button>
            </resendAllFetcher.Form>
          )}
        </div>
        {resendAllFetcher.data?.error && <p className="msg-error">{resendAllFetcher.data.error}</p>}
        {resendAllFetcher.data?.success && (
          <p className="msg-success">{resendAllFetcher.data.success}</p>
        )}

        <div className="tab-row" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'registered'}
            className={`tab-btn ${tab === 'registered' ? 'tab-btn-active' : ''}`}
            onClick={() => setTab('registered')}
          >
            登録済み<span className="tab-count">{registered.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'pending'}
            className={`tab-btn ${tab === 'pending' ? 'tab-btn-active' : ''}`}
            onClick={() => setTab('pending')}
          >
            未登録<span className="tab-count">{pending.length}</span>
          </button>
        </div>

        {visibleEmployees.length === 0 ? (
          <p style={{color: '#666'}}>
            {tab === 'registered'
              ? 'まだ登録済みの従業員がいません。'
              : '未登録（招待中）の従業員はいません。'}
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {/* 会員利用規約v2 第7条: 個人別は「注文回数」まで。
                    購入金額・割引額・商品名は企業に開示しない */}
                {['名前', 'メール', '権限', 'ステータス', '最終ログイン', '注文数', '操作'].map(
                  (h) => (
                    <th key={h}>{h}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visibleEmployees.map((emp) => (
                <EmployeeRow key={emp.id} emp={emp} stats={statsByUser.get(emp.id)} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: '登録済み',
  pending: '招待中',
  inactive: '停止中',
};

function EmployeeRow({
  emp,
  stats,
}: {
  emp: Record<string, any>;
  stats?: {count: number};
}) {
  const fetcher = useFetcher<ActionData>();
  const name =
    emp.last_name && emp.first_name ? `${emp.last_name} ${emp.first_name}` : '-';

  return (
    <tr>
      <td>{name}</td>
      <td>{emp.email}</td>
      <td>{emp.role === 'company_admin' ? '管理者' : '従業員'}</td>
      <td>
        <span className={`badge ${emp.status === 'active' ? 'badge-active' : 'badge-pending'}`}>
          {STATUS_LABEL[emp.status] ?? emp.status}
        </span>
      </td>
      <td>{emp.last_login_at ? new Date(emp.last_login_at).toLocaleDateString('ja-JP') : '-'}</td>
      <td>{stats?.count ?? 0}件</td>
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
