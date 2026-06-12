import {useLoaderData, Link} from 'react-router';
import {requireRole} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/admin.abuse-watch';

// 検知ウィンドウと閾値（規約第5条の2の運用補助。あくまで「要確認」のフラグ）
const WINDOW_DAYS = 30;
const FLAG_THRESHOLD = 5; // 期間内に注文者≠配送先の注文がこの件数以上で要確認

/** 氏名を比較用に正規化（空白・全半角スペース除去） */
function normalizeName(s: string | null | undefined): string {
  return (s ?? '').replace(/[\s　]+/g, '').trim();
}

type ShippingAddress = Record<string, string | null> | null;

/** 配送先の受取人名を取り出す */
function recipientName(addr: ShippingAddress): string {
  if (!addr) return '';
  if (addr.name) return addr.name;
  return `${addr.last_name ?? ''}${addr.first_name ?? ''}`;
}

export async function loader({request, context}: Route.LoaderArgs) {
  await requireRole(request, context.env, ['super_admin']);
  const supabase = createSupabaseAdmin(context.env);

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
  const {data: orders} = await supabase
    .from('orders')
    .select('id, user_id, company_id, order_name, shipping_address, created_at')
    .eq('status', 'paid')
    .gte('created_at', since)
    .order('created_at', {ascending: false});

  const rows = orders ?? [];
  const userIds = [...new Set(rows.map((o) => o.user_id).filter(Boolean))] as string[];

  const [{data: users}, {data: companies}] = await Promise.all([
    userIds.length
      ? supabase
          .from('users')
          .select('id, last_name, first_name, email, company_id, role')
          .in('id', userIds)
      : Promise.resolve({data: []}),
    supabase.from('companies').select('id, name'),
  ]);

  const userMap = new Map(
    (users ?? []).map((u) => [
      u.id,
      {
        name: `${u.last_name ?? ''}${u.first_name ?? ''}`,
        email: u.email,
        company_id: u.company_id,
        role: u.role,
      },
    ]),
  );
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name]));

  // 会員ごとに集計
  const agg = new Map<
    string,
    {total: number; mismatch: number; recipients: Set<string>}
  >();
  for (const o of rows) {
    if (!o.user_id) continue;
    const u = userMap.get(o.user_id);
    const ordererName = normalizeName(u?.name);
    const recip = normalizeName(recipientName(o.shipping_address as ShippingAddress));
    const a = agg.get(o.user_id) ?? {total: 0, mismatch: 0, recipients: new Set<string>()};
    a.total += 1;
    // 注文者名・受取人名の両方が判定できる場合のみ「不一致」を数える
    if (ordererName && recip && ordererName !== recip) {
      a.mismatch += 1;
      a.recipients.add(recip);
    }
    agg.set(o.user_id, a);
  }

  const watchlist = [...agg.entries()]
    .map(([userId, a]) => {
      const u = userMap.get(userId);
      return {
        userId,
        name: u?.name || '（氏名未登録）',
        email: u?.email ?? '',
        company: (u?.company_id && companyMap.get(u.company_id)) || '—',
        role: u?.role ?? '',
        total: a.total,
        mismatch: a.mismatch,
        distinctRecipients: a.recipients.size,
        flagged: a.mismatch >= FLAG_THRESHOLD,
      };
    })
    .filter((w) => w.mismatch > 0)
    .sort((x, y) => y.mismatch - x.mismatch);

  return {
    watchlist,
    flaggedCount: watchlist.filter((w) => w.flagged).length,
    windowDays: WINDOW_DAYS,
    threshold: FLAG_THRESHOLD,
    totalOrders: rows.length,
  };
}

export default function AbuseWatchPage() {
  const {watchlist, flaggedCount, windowDays, threshold, totalOrders} =
    useLoaderData<typeof loader>();

  return (
    <div className="admin-page">
      <div className="page-heading">
        <h1>不正利用ウォッチ</h1>
        <Link to="/admin" style={{fontSize: '0.875rem', color: '#2563eb'}}>
          ← 運営管理トップ
        </Link>
      </div>

      <p style={{color: '#555', marginBottom: '1rem'}}>
        直近<strong>{windowDays}日</strong>の注文のうち、<strong>注文者ご本人と配送先の受取人名が異なる</strong>注文の件数を会員ごとに集計しています。
        贈答（ギフト）の場合も不一致になるため、これは「<strong>要確認のフラグ</strong>」であり、即座に違反を意味するものではありません。
        会員規約 第5条の2 に基づく確認・対応の判断材料としてご活用ください。
      </p>

      <div
        style={{
          background: flaggedCount > 0 ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${flaggedCount > 0 ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: 6,
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
        }}
      >
        対象注文 {totalOrders}件 ／ 受取人名が異なる注文がある会員 {watchlist.length}名 ／{' '}
        <strong style={{color: flaggedCount > 0 ? '#dc2626' : '#16a34a'}}>
          要確認（{threshold}件以上）{flaggedCount}名
        </strong>
      </div>

      {watchlist.length === 0 ? (
        <p style={{color: '#666'}}>
          直近{windowDays}日で、受取人名が異なる注文は検出されていません。
        </p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              {['', '会員', 'メール', '企業', '注文数', '不一致注文', '宛先数'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {watchlist.map((w) => (
              <tr key={w.userId} style={w.flagged ? {background: '#fef2f2'} : undefined}>
                <td>
                  {w.flagged && (
                    <span
                      title={`不一致注文が${threshold}件以上`}
                      style={{
                        display: 'inline-block',
                        background: '#dc2626',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: 4,
                        padding: '0.1rem 0.4rem',
                      }}
                    >
                      要確認
                    </span>
                  )}
                </td>
                <td>{w.name}</td>
                <td style={{fontSize: '0.8125rem'}}>{w.email}</td>
                <td>{w.company}</td>
                <td>{w.total}件</td>
                <td style={{fontWeight: w.flagged ? 700 : 400, color: w.flagged ? '#dc2626' : undefined}}>
                  {w.mismatch}件
                </td>
                <td>{w.distinctRecipients}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{color: '#888', fontSize: '0.8125rem', marginTop: '1rem'}}>
        ※ 注文者・受取人の氏名がいずれも登録されている注文のみ判定します。氏名の表記ゆれ（スペース等）は正規化して比較します。
      </p>
    </div>
  );
}
