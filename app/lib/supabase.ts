import {createClient} from '@supabase/supabase-js';

// サーバー側のみで使用（service_role key）
export function createSupabaseAdmin(env: {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {persistSession: false},
  });
}

// クライアント側でも使用可能（anon key）
export function createSupabaseClient(env: {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}
