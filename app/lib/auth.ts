import {redirect} from 'react-router';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {UserRole} from '~/types/supabase';

// Hydrogen の session インターフェースに合わせた最小型
interface SessionLike {
  get(key: string): unknown;
  set(key: string, value: string): void;
  unset(key: string): void;
  commit(): Promise<string>;
  isPending?: boolean;
}

const SESSION_KEY_ACCESS = 'sb_access_token';
const SESSION_KEY_REFRESH = 'sb_refresh_token';

/** セッションから認証済みユーザーを取得。未認証なら null */
export async function getAuthUser(
  session: SessionLike,
  env: Env,
) {
  const accessToken = session.get(SESSION_KEY_ACCESS) as string | undefined;
  const refreshToken = session.get(SESSION_KEY_REFRESH) as string | undefined;

  if (!accessToken || !refreshToken) return null;

  const supabase = createSupabaseAdmin(env);

  // トークンをセット
  const {data, error} = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.user) return null;

  // リフレッシュされた場合はセッション更新
  if (data.session) {
    session.set(SESSION_KEY_ACCESS, data.session.access_token);
    session.set(SESSION_KEY_REFRESH, data.session.refresh_token);
  }

  // DB からユーザー情報取得（ロール等）
  const {data: userRow} = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (!userRow || userRow.status === 'deleted' || userRow.status === 'inactive') return null;

  return userRow;
}

/** ログイン必須ガード。未認証なら /login へリダイレクト */
export async function requireAuth(session: SessionLike, env: Env) {
  const user = await getAuthUser(session, env);
  if (!user) throw redirect('/login');
  return user;
}

/** 特定ロール必須ガード */
export async function requireRole(
  session: SessionLike,
  env: Env,
  roles: UserRole[],
) {
  const user = await requireAuth(session, env);
  if (!roles.includes(user.role as UserRole)) throw redirect('/products');
  return user;
}

/** ログイン処理 */
export async function signIn(
  email: string,
  password: string,
  session: SessionLike,
  env: Env,
) {
  const supabase = createSupabaseAdmin(env);
  const {data, error} = await supabase.auth.signInWithPassword({email, password});

  if (error || !data.session) {
    return {error: 'メールアドレスまたはパスワードが正しくありません'};
  }

  session.set(SESSION_KEY_ACCESS, data.session.access_token);
  session.set(SESSION_KEY_REFRESH, data.session.refresh_token);

  // 最終ログイン日時を更新
  await supabase
    .from('users')
    .update({last_login_at: new Date().toISOString()})
    .eq('id', data.user.id);

  return {userId: data.user.id};
}

/** ログアウト処理 */
export async function signOut(session: SessionLike, env: Env) {
  const accessToken = session.get(SESSION_KEY_ACCESS) as string | undefined;
  if (accessToken) {
    const supabase = createSupabaseAdmin(env);
    await supabase.auth.admin.signOut(accessToken);
  }
  session.unset(SESSION_KEY_ACCESS);
  session.unset(SESSION_KEY_REFRESH);
}
