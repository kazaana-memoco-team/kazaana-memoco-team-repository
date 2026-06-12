// 会員の配送先住所帳（addresses テーブル）の取得ヘルパー。
// root loader / checkout / マイページから利用する。失敗時は安全に空を返す。

import {createSupabaseAdmin} from '~/lib/supabase';
import type {Database} from '~/types/supabase';

export type Address = Database['public']['Tables']['addresses']['Row'];

type AddressEnv = {SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string};

/** 会員の保存済み配送先一覧（デフォルト→新しい順） */
export async function getAddresses(
  env: AddressEnv,
  userId: string,
): Promise<Address[]> {
  try {
    const supabase = createSupabaseAdmin(env);
    const {data} = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', {ascending: false})
      .order('created_at', {ascending: false});
    return data ?? [];
  } catch (e) {
    console.error('[addresses] 取得失敗:', e);
    return [];
  }
}

/** 指定IDの配送先を取得（本人のものに限定） */
export async function getAddress(
  env: AddressEnv,
  id: string,
  userId: string,
): Promise<Address | null> {
  try {
    const supabase = createSupabaseAdmin(env);
    const {data} = await supabase
      .from('addresses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    return (data as Address) ?? null;
  } catch (e) {
    console.error('[addresses] 取得失敗(single):', e);
    return null;
  }
}

/** Shopify Draft Order の shipping_address 形式へ変換 */
export function toShopifyShippingAddress(a: Address) {
  return {
    last_name: a.recipient_name, // 宛名は last_name に集約（name は Shopify 側で導出）
    address1: a.address1 ?? '',
    address2: a.building ?? '',
    city: a.city ?? '',
    province: a.prefecture ?? '',
    zip: a.postal_code ?? '',
    country: 'Japan',
    country_code: 'JP',
    phone: a.phone ?? '',
  };
}
