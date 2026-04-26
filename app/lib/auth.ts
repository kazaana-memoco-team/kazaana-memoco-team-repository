import {redirect} from 'react-router';
import {createSupabaseAdmin} from '~/lib/supabase';
import {getTokensFromRequest} from '~/lib/auth-cookie';
import type {UserRole} from '~/types/supabase';

/** リクエストから認証済みユーザーを取得。未認証なら null */
export async function getAuthUser(request: Request, env: Env) {
  const {accessToken, refreshToken} = getTokensFromRequest(request);

  if (!accessToken || !refreshToken) return null;

  const supabase = createSupabaseAdmin(env);

  const {data: {user}, error} = await supabase.auth.getUser(accessToken);

  if (error || !user) return null;

  const {data: userRow} = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!userRow || userRow.status === 'deleted' || userRow.status === 'inactive') return null;

  return userRow;
}

/** ログイン必須ガード。未認証なら /login へリダイレクト */
export async function requireAuth(request: Request, env: Env) {
  const user = await getAuthUser(request, env);
  if (!user) throw redirect('/login');
  return user;
}

/** 特定ロール必須ガード */
export async function requireRole(
  request: Request,
  env: Env,
  roles: UserRole[],
) {
  const user = await requireAuth(request, env);
  if (!roles.includes(user.role as UserRole)) throw redirect('/');
  return user;
}

/** ログイン処理 */
export async function signIn(email: string, password: string, env: Env) {
  const supabase = createSupabaseAdmin(env);
  const {data, error} = await supabase.auth.signInWithPassword({email, password});

  if (error || !data.session) {
    return {error: 'メールアドレスまたはパスワードが正しくありません'};
  }

  await supabase
    .from('users')
    .update({last_login_at: new Date().toISOString()})
    .eq('id', data.user.id);

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}
