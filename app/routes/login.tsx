import {redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/login';
import {signIn, getAuthUser} from '~/lib/auth';
import {buildLoginHeaders} from '~/lib/auth-cookie';

export const meta: Route.MetaFunction = () => [
  {title: 'ログイン | 会員制BECOS'},
];

export async function loader({request, context}: Route.LoaderArgs) {
  const user = await getAuthUser(request, context.env);
  if (user) throw redirect('/');
  const url = new URL(request.url);
  return {error: url.searchParams.get('error')};
}

export async function action({request, context}: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return redirect('/login?error=' + encodeURIComponent('メールアドレスとパスワードを入力してください'));
  }

  const result = await signIn(email, password, context.env);

  if (result.error) {
    return redirect('/login?error=' + encodeURIComponent(result.error));
  }

  return new Response(null, {
    status: 302,
    headers: buildLoginHeaders(result.accessToken!, result.refreshToken!),
  });
}

export default function LoginPage() {
  const {error} = useLoaderData<typeof loader>();

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>会員制BECOS</h1>
          <p>福利厚生サービス</p>
        </div>

        <form method="post" className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">メールアドレス</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="example@company.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="login-button">
            ログイン
          </button>
        </form>

        <p className="login-note">
          アカウントをお持ちでない方は、管理者からの招待メールをご確認ください。
        </p>
      </div>
    </div>
  );
}
