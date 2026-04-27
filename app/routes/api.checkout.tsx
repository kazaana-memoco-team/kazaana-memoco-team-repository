import {redirect} from 'react-router';
import type {Route} from './+types/api.checkout';
import {requireAuth} from '~/lib/auth';
import {createDraftOrder} from '~/lib/draft-orders';

export async function action({request, context}: Route.ActionArgs) {
  // 認証チェック
  const user = await requireAuth(request, context.env);

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

  // Draft Order を作成
  const invoiceUrl = await createDraftOrder(lineItems, context.env, {
    userId: user.id,
  });

  if (!invoiceUrl) {
    return redirect('/cart?error=checkout_failed');
  }

  // Shopify の Draft Order 決済ページへリダイレクト
  return redirect(invoiceUrl);
}

// GET リクエストはカートへ
export async function loader() {
  return redirect('/cart');
}
