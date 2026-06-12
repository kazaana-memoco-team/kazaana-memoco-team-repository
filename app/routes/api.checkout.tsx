import {redirect} from 'react-router';
import type {Route} from './+types/api.checkout';
import {requireAuth} from '~/lib/auth';
import {createDraftOrder} from '~/lib/draft-orders';
import {getDiscountMap} from '~/lib/discounts';
import {getAddress, toShopifyShippingAddress} from '~/lib/addresses';

export async function action({request, context}: Route.ActionArgs) {
  // 認証チェック
  const user = await requireAuth(request, context.env);

  // 選択された配送先（任意。未選択なら Shopify 決済画面で入力）
  const formData = await request.formData().catch(() => null);
  const addressId = formData ? String(formData.get('address_id') ?? '').trim() : '';
  let shippingAddress;
  if (addressId) {
    const addr = await getAddress(context.env, addressId, user.id);
    if (addr) shippingAddress = toShopifyShippingAddress(addr);
  }

  // カートを取得
  const cart = await context.cart.get();
  if (!cart?.lines?.nodes?.length) {
    return redirect('/cart');
  }

  // Draft Order 用のライン items を構築
  const lineItems = cart.lines.nodes.map((line: any) => ({
    variantGid: line.merchandise.id,
    quantity: line.quantity,
    regularPrice: line.merchandise.price.amount,
    currencyCode: line.merchandise.price.currencyCode,
    productHandle: line.merchandise.product?.handle ?? '',
  }));

  // Draft Order を作成（表示と同じ個別割引率を適用）
  const discountMap = await getDiscountMap(context.env);
  const invoiceUrl = await createDraftOrder(
    lineItems,
    context.env,
    {userId: user.id},
    discountMap,
    shippingAddress,
  );

  if (!invoiceUrl) {
    return redirect('/cart?error=checkout_failed');
  }

  // Draft Order 決済へ進む時点で Hydrogen 側のカートを空にする。
  // これをしないと決済後に戻ってきてもカートに商品が残り、二重注文の原因になる。
  let headers = new Headers();
  const lineIds = cart.lines.nodes.map((line: any) => line.id);
  if (lineIds.length) {
    const cleared = await context.cart.removeLines(lineIds);
    if (cleared?.cart?.id) {
      headers = context.cart.setCartId(cleared.cart.id);
    }
  }

  // Shopify の Draft Order 決済ページへリダイレクト
  return redirect(invoiceUrl, {headers});
}

// GET リクエストはカートへ
export async function loader() {
  return redirect('/cart');
}
