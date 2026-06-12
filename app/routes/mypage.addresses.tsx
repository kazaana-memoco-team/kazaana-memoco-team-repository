import {useFetcher, useLoaderData, Link} from 'react-router';
import {requireAuth} from '~/lib/auth';
import {createSupabaseAdmin} from '~/lib/supabase';
import {getAddresses, type Address} from '~/lib/addresses';
import type {Route} from './+types/mypage.addresses';

type ActionData = {error?: string; success?: string};

export async function loader({request, context}: Route.LoaderArgs) {
  const user = await requireAuth(request, context.env);
  const addresses = await getAddresses(context.env, user.id);
  return {addresses};
}

function readForm(formData: FormData) {
  const recipient_name = String(formData.get('recipient_name') ?? '').trim();
  return {
    label: String(formData.get('label') ?? '').trim() || null,
    recipient_name,
    postal_code: String(formData.get('postal_code') ?? '').trim() || null,
    prefecture: String(formData.get('prefecture') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    address1: String(formData.get('address1') ?? '').trim() || null,
    building: String(formData.get('building') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    is_default: formData.get('is_default') === 'on',
  };
}

export async function action({request, context}: Route.ActionArgs): Promise<ActionData> {
  const user = await requireAuth(request, context.env);
  const supabase = createSupabaseAdmin(context.env);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');

  // デフォルトに設定する際、他の住所のデフォルトを外す
  const clearDefaults = async () => {
    await supabase
      .from('addresses')
      .update({is_default: false})
      .eq('user_id', user.id);
  };

  if (intent === 'create' || intent === 'update') {
    const values = readForm(formData);
    if (!values.recipient_name) return {error: 'お届け先の宛名を入力してください'};
    if (values.is_default) await clearDefaults();

    if (intent === 'create') {
      const {error} = await supabase
        .from('addresses')
        .insert({...values, user_id: user.id});
      if (error) return {error: error.message};
      return {success: '配送先を追加しました'};
    } else {
      const id = String(formData.get('id') ?? '');
      const {error} = await supabase
        .from('addresses')
        .update(values)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) return {error: error.message};
      return {success: '配送先を更新しました'};
    }
  }

  if (intent === 'set_default') {
    const id = String(formData.get('id') ?? '');
    await clearDefaults();
    const {error} = await supabase
      .from('addresses')
      .update({is_default: true})
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return {error: error.message};
    return {success: 'デフォルトの配送先に設定しました'};
  }

  if (intent === 'delete') {
    const id = String(formData.get('id') ?? '');
    const {error} = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return {error: error.message};
    return {success: '配送先を削除しました'};
  }

  return {error: '不明な操作です'};
}

export default function MypageAddressesPage() {
  const {addresses} = useLoaderData<typeof loader>();
  const createFetcher = useFetcher<ActionData>();

  return (
    <div className="mypage-page">
      <div className="page-heading">
        <h1>お届け先の管理</h1>
        <Link to="/mypage" style={{fontSize: '0.875rem', color: '#2563eb'}}>
          ← マイページ
        </Link>
      </div>
      <p style={{color: '#555', marginBottom: '1.5rem'}}>
        よく使うお届け先を登録しておくと、ご購入時に選ぶだけで配送先を指定できます（贈り物の発送にも便利です）。
      </p>

      <section className="admin-section">
        <h2>新しいお届け先を追加</h2>
        <createFetcher.Form method="post">
          <input type="hidden" name="intent" value="create" />
          <AddressFields />
          <button type="submit" disabled={createFetcher.state !== 'idle'} className="btn-primary">
            追加
          </button>
        </createFetcher.Form>
        {createFetcher.data?.error && <p className="msg-error">{createFetcher.data.error}</p>}
        {createFetcher.data?.success && <p className="msg-success">{createFetcher.data.success}</p>}
      </section>

      <section>
        <h2>登録済みのお届け先（{addresses.length}件）</h2>
        {addresses.length === 0 ? (
          <p style={{color: '#666'}}>まだお届け先が登録されていません。</p>
        ) : (
          <div className="address-list">
            {addresses.map((a) => (
              <AddressCard key={a.id} address={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AddressFields({a}: {a?: Address}) {
  return (
    <div className="address-form-grid">
      <label>
        ラベル（任意）
        <input name="label" type="text" defaultValue={a?.label ?? ''} placeholder="例: 自宅・実家" className="form-input" />
      </label>
      <label>
        お届け先の宛名<span className="req">*</span>
        <input name="recipient_name" type="text" required defaultValue={a?.recipient_name ?? ''} placeholder="例: 山田 花子" className="form-input" />
      </label>
      <label>
        郵便番号
        <input name="postal_code" type="text" defaultValue={a?.postal_code ?? ''} placeholder="1040031" className="form-input" inputMode="numeric" />
      </label>
      <label>
        都道府県
        <input name="prefecture" type="text" defaultValue={a?.prefecture ?? ''} placeholder="東京都" className="form-input" />
      </label>
      <label>
        市区町村
        <input name="city" type="text" defaultValue={a?.city ?? ''} placeholder="中央区京橋" className="form-input" />
      </label>
      <label>
        町名・番地
        <input name="address1" type="text" defaultValue={a?.address1 ?? ''} placeholder="1-1-5" className="form-input" />
      </label>
      <label>
        建物名・部屋番号
        <input name="building" type="text" defaultValue={a?.building ?? ''} placeholder="セントラルビル2階" className="form-input" />
      </label>
      <label>
        電話番号
        <input name="phone" type="tel" defaultValue={a?.phone ?? ''} placeholder="0312345678" className="form-input" />
      </label>
      <label className="address-default-check">
        <input name="is_default" type="checkbox" defaultChecked={a?.is_default ?? false} /> デフォルトのお届け先にする
      </label>
    </div>
  );
}

function AddressCard({address: a}: {address: Address}) {
  const fetcher = useFetcher<ActionData>();
  return (
    <div className={`address-card${a.is_default ? ' address-card-default' : ''}`}>
      <div className="address-card-head">
        <strong>{a.recipient_name}</strong>
        {a.label && <span className="address-card-label">{a.label}</span>}
        {a.is_default && <span className="address-card-badge">デフォルト</span>}
      </div>
      <p className="address-card-body">
        {a.postal_code && <>〒{a.postal_code}<br /></>}
        {a.prefecture}
        {a.city}
        {a.address1}
        {a.building && <> {a.building}</>}
        {a.phone && <><br />TEL: {a.phone}</>}
      </p>
      <div className="address-card-actions">
        {!a.is_default && (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="set_default" />
            <input type="hidden" name="id" value={a.id} />
            <button type="submit" className="btn-sm">デフォルトにする</button>
          </fetcher.Form>
        )}
        <details className="address-edit">
          <summary className="btn-sm">編集</summary>
          <fetcher.Form method="post" style={{marginTop: '0.75rem'}}>
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="id" value={a.id} />
            <AddressFields a={a} />
            <button type="submit" className="btn-primary">更新</button>
          </fetcher.Form>
        </details>
        <fetcher.Form
          method="post"
          onSubmit={(e) => {
            if (!confirm(`「${a.recipient_name}」のお届け先を削除しますか？`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={a.id} />
          <button type="submit" className="btn-sm btn-danger">削除</button>
        </fetcher.Form>
      </div>
      {fetcher.data?.error && <p className="msg-error msg-sm">{fetcher.data.error}</p>}
      {fetcher.data?.success && <p className="msg-success msg-sm">{fetcher.data.success}</p>}
    </div>
  );
}
