import {Link} from 'react-router';

/** 企業管理画面のメインメニュー（RWの /manage サイドメニュー相当） */
export function DashboardNav({current}: {current: 'users' | 'plan'}) {
  return (
    <nav className="dash-nav">
      <Link to="/dashboard" className={current === 'users' ? 'dash-nav-active' : ''}>
        従業員管理
      </Link>
      <Link to="/dashboard/plan" className={current === 'plan' ? 'dash-nav-active' : ''}>
        ご契約内容
      </Link>
    </nav>
  );
}
