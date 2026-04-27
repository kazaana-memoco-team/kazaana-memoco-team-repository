import {Suspense} from 'react';
import {Await, NavLink, useAsyncValue} from 'react-router';
import {useOptimisticCart} from '@shopify/hydrogen';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';

interface BottomNavProps {
  cart: Promise<CartApiQueryFragment | null>;
  userRole?: string | null;
}

export function BottomNav({cart, userRole}: BottomNavProps) {
  const {open} = useAside();
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Mobile navigation">
      <NavLink to="/" end className="bottom-nav-item" prefetch="intent">
        <span className="bottom-nav-icon" aria-hidden>
          ⌂
        </span>
        <span className="bottom-nav-label">ホーム</span>
      </NavLink>
      <NavLink
        to="/collections"
        className="bottom-nav-item"
        prefetch="intent"
      >
        <span className="bottom-nav-icon" aria-hidden>
          ▦
        </span>
        <span className="bottom-nav-label">カテゴリ</span>
      </NavLink>
      <button
        type="button"
        className="bottom-nav-item bottom-nav-button"
        onClick={() => open('search')}
      >
        <span className="bottom-nav-icon" aria-hidden>
          ⌕
        </span>
        <span className="bottom-nav-label">検索</span>
      </button>
      <button
        type="button"
        className="bottom-nav-item bottom-nav-button"
        onClick={() => open('cart')}
      >
        <span className="bottom-nav-icon" aria-hidden>
          ⊕
        </span>
        <span className="bottom-nav-label">
          カート
          <Suspense fallback={null}>
            <Await resolve={cart}>
              <CartCountBadge />
            </Await>
          </Suspense>
        </span>
      </button>
      {userRole ? (
        <NavLink to="/mypage" className="bottom-nav-item" prefetch="intent">
          <span className="bottom-nav-icon" aria-hidden>☻</span>
          <span className="bottom-nav-label">マイページ</span>
        </NavLink>
      ) : (
        <NavLink to="/login" className="bottom-nav-item" prefetch="intent">
          <span className="bottom-nav-icon" aria-hidden>☻</span>
          <span className="bottom-nav-label">ログイン</span>
        </NavLink>
      )}
    </nav>
  );
}

function CartCountBadge() {
  const original = useAsyncValue() as CartApiQueryFragment | null;
  const optimistic = useOptimisticCart(original);
  const count = optimistic?.totalQuantity ?? 0;
  if (count <= 0) return null;
  return <span className="bottom-nav-badge">{count}</span>;
}
