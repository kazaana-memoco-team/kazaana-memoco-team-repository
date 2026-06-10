import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {useRouteLoaderData} from 'react-router';
import {applyDiscount} from '~/lib/pricing';
import type {RootLoader} from '~/root';

export function ProductPrice({
  price,
  compareAtPrice,
  handle,
}: {
  price?: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
  handle?: string;
}) {
  const rootData = useRouteLoaderData<RootLoader>('root');

  if (!price) {
    return (
      <div aria-label="Price" className="product-price" role="group">
        <span>&nbsp;</span>
      </div>
    );
  }

  const discounted = applyDiscount(price, handle, rootData?.discountMap);
  const isDiscounted = discounted.amount !== price.amount;

  if (isDiscounted) {
    // バッジは実際の価格差から算出（個別割引・固定価格上書きのどちらでも正確）
    const offPercent = Math.round(
      (1 - Number(discounted.amount) / Number(price.amount)) * 100,
    );
    return (
      <div aria-label="Price" className="product-price product-price-on-sale" role="group">
        <Money data={discounted} />{' '}
        <s>
          <Money data={price} />
        </s>{' '}
        <span className="price-badge">{offPercent}%OFF</span>
      </div>
    );
  }

  if (compareAtPrice) {
    return (
      <div aria-label="Price" className="product-price product-price-on-sale" role="group">
        <Money data={price} />{' '}
        <s>
          <Money data={compareAtPrice} />
        </s>
      </div>
    );
  }

  return (
    <div aria-label="Price" className="product-price" role="group">
      <Money data={price} />
    </div>
  );
}
