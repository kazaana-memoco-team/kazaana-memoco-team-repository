import {data, redirect, Form, useActionData, useNavigation} from 'react-router';
import type {Route} from './+types/login';
import {signIn, getAuthUser} from '~/lib/auth';

export const meta: Route.MetaFunction = () => [
  {title: 'ログイン | 会員制BECOS'},
];

export async function loader({context}: Route.LoaderArgs) {
  const user = await getAuthUser(context.session, context.env);
  if (user) throw redirect('/products');
  return null;
}

export async function action({request, context}: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return data({error: 'メールアドレスとパスワードを入力してください'}, {status: 400});
  }

  const result = await signIn(email, password, context.session, context.env);

  if (result.error) {
    return data({error: result.error}, {status: 401});
  }

  const headers = new Headers();
  headers.set('Set-Cookie', await context.session.commit());
  return redirect('/products', {headers});
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>会員制BECOS</h1>
          <p>福利厚生サービス</p>
        </div>

        <Form method="post" className="login-form">
          {actionData?.error && (
            <div className="login-error">{actionData.error}</div>
          )}

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

          <button type="submit" disabled={isSubmitting} className="login-button">
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </Form>

        <p className="login-note">
          アカウントをお持ちでない方は、管理者からの招待メールをご確認ください。
        </p>
      </div>
    </div>
  );
}
