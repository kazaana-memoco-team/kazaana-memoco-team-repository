import {buildLoginHeaders} from '~/lib/auth-cookie';
import type {Route} from './+types/api.auth.callback';

/** ハッシュベーストークン（旧 Supabase フロー）をクッキーに変換する API */
export async function action({request}: Route.ActionArgs) {
  let body: {accessToken?: string; refreshToken?: string};
  try {
    body = (await request.json()) as {accessToken?: string; refreshToken?: string};
  } catch {
    return new Response('Bad Request', {status: 400});
  }

  const {accessToken, refreshToken} = body;
  if (!accessToken || !refreshToken) {
    return new Response('Bad Request', {status: 400});
  }

  const headers = buildLoginHeaders(accessToken, refreshToken, '/auth/set-password');
  headers.delete('Location');

  return new Response('ok', {status: 200, headers});
}

export async function loader() {
  return new Response('Not Found', {status: 404});
}
