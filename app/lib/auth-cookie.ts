// Hydrogen の AppSession を迂回し、生 Cookie でトークンを管理する
// （MiniOxygen の Cookie フォワーディング問題を回避するため）

const ACCESS_COOKIE = 'sb_access';
const REFRESH_COOKIE = 'sb_refresh';
const COOKIE_OPTS = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=28800'; // 8時間

export function getTokensFromRequest(request: Request): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  const cookieHeader = request.headers.get('Cookie') ?? '';
  return {
    accessToken: parseCookie(cookieHeader, ACCESS_COOKIE),
    refreshToken: parseCookie(cookieHeader, REFRESH_COOKIE),
  };
}

export function buildLoginHeaders(
  accessToken: string,
  refreshToken: string,
  redirectTo = '/',
): Headers {
  const headers = new Headers();
  headers.set('Location', redirectTo);
  headers.append('Set-Cookie', `${ACCESS_COOKIE}=${accessToken}; ${COOKIE_OPTS}`);
  headers.append('Set-Cookie', `${REFRESH_COOKIE}=${refreshToken}; ${COOKIE_OPTS}`);
  return headers;
}

export function buildLogoutHeaders(redirectTo = '/login'): Headers {
  const headers = new Headers();
  headers.set('Location', redirectTo);
  headers.append('Set-Cookie', `${ACCESS_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  headers.append('Set-Cookie', `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return headers;
}

function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key.trim() === name) return rest.join('=').trim() || null;
  }
  return null;
}
