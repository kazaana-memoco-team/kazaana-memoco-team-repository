import {redirect} from 'react-router';
import {Form, useActionData} from 'react-router';
import {requireAuth} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/auth.set-password';

type ActionData = {error?: string};

export async function loader({request, context}: Route.LoaderArgs) {
  await requireAuth(request, context.env);
  return {};
}

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ActionData | Response> {
  const user = await requireAuth(request, context.env);
  const formData = await request.formData();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) {
    return {error: 'パスワードは8文字以上で入力してください'};
  }
  if (password !== confirm) {
    return {error: 'パスワードが一致しません'};
  }

  const supabase = createSupabaseAdmin(context.env);
  const {error} = await supabase.auth.admin.updateUserById(user.id, {password});

  if (error) return {error: error.message};

  return redirect('/mypage');
}

export default function SetPasswordPage() {
  const data = useActionData<typeof action>();

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '5rem auto',
        padding: '2rem',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        background: '#fff',
      }}
    >
      <h1 style={{marginTop: 0, marginBottom: '0.5rem', fontSize: '1.375rem'}}>
        パスワードを設定
      </h1>
      <p style={{color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.75rem'}}>
        アカウントへようこそ。ログインに使うパスワードを設定してください。
      </p>

      <Form method="post">
        <div style={{marginBottom: '1rem'}}>
          <label
            htmlFor="password"
            style={{
              display: 'block',
              marginBottom: '0.3rem',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            パスワード（8文字以上）
          </label>
          <input
            id="password"
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{marginBottom: '1.5rem'}}>
          <label
            htmlFor="confirm"
            style={{
              display: 'block',
              marginBottom: '0.3rem',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            パスワード（確認用）
          </label>
          <input
            id="confirm"
            type="password"
            name="confirm"
            required
            autoComplete="new-password"
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {data && 'error' in data && data.error && (
          <p
            style={{
              color: '#dc2626',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              marginTop: 0,
            }}
          >
            {data.error}
          </p>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: '1rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          パスワードを設定して開始
        </button>
      </Form>
    </div>
  );
}
