import {redirect} from 'react-router';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';
import {createSupabaseAdmin} from '~/lib/supabase';
import {buildLoginHeaders} from '~/lib/auth-cookie';
import type {Route} from './+types/auth.confirm';

/**
 * Supabase 招待メールのコールバックを処理する。
 *
 * PKCE フロー（新しい Supabase）: ?token_hash=xxx&type=invite → サーバー側で処理
 * ハッシュフロー（古い Supabase）: #access_token=xxx&... → クライアント側で処理
 */
export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  if (tokenHash && type) {
    const supabase = createSupabaseAdmin(context.env);
    const {data, error} = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'invite' | 'magiclink' | 'recovery' | 'email',
    });

    if (error || !data.session) {
      const msg = '招待リンクが無効または期限切れです。管理者に再送信を依頼してください。';
      return redirect('/login?error=' + encodeURIComponent(msg));
    }

    const headers = buildLoginHeaders(
      data.session.access_token,
      data.session.refresh_token,
      '/auth/set-password',
    );
    return new Response(null, {status: 302, headers});
  }

  // token_hash がない場合はクライアント側（ハッシュフロー）で処理
  return {};
}

export default function AuthConfirmPage() {
  const [status, setStatus] = useState<'checking' | 'error'>('checking');
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      setStatus('error');
      return;
    }

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setStatus('error');
      return;
    }

    fetch('/api/auth/callback', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({accessToken, refreshToken}),
    })
      .then((res) => {
        if (res.ok) {
          navigate('/auth/set-password');
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [navigate]);

  if (status === 'error') {
    return (
      <div style={{maxWidth: 420, margin: '5rem auto', padding: '2rem', textAlign: 'center'}}>
        <p style={{color: '#dc2626', marginBottom: '1rem'}}>
          招待リンクが無効または期限切れです。
        </p>
        <a href="/login" style={{color: '#2563eb'}}>
          ログインページへ
        </a>
      </div>
    );
  }

  return (
    <div style={{maxWidth: 420, margin: '5rem auto', padding: '2rem', textAlign: 'center'}}>
      <p style={{color: '#666'}}>認証を確認中...</p>
    </div>
  );
}
