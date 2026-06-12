import {Link} from 'react-router';
import type {Route} from './+types/policies._index';

export const meta: Route.MetaFunction = () => [
  {title: 'JAPAN BENEFITS｜各種ポリシー'},
];

const ITEMS = [
  {
    to: '/policies/terms',
    title: '会員利用規約',
    desc: '本サービスを利用する会員（従業員・ご家族）の利用条件',
  },
  {
    to: '/policies/privacy',
    title: 'プライバシーポリシー',
    desc: '個人情報の取扱い・契約企業への開示範囲について',
  },
  {
    to: '/policies/tokushoho',
    title: '特定商取引法に基づく表示',
    desc: '販売業者・送料・返品条件など、ご購入前にご確認ください',
  },
];

export default function PoliciesIndex() {
  return (
    <div className="policy-page">
      <h1>各種ポリシー</h1>
      <div className="policy-index-list">
        {ITEMS.map((it) => (
          <Link key={it.to} to={it.to} className="policy-index-card">
            <span className="policy-index-title">{it.title}</span>
            <span className="policy-index-desc">{it.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
