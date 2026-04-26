import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {applyDiscount, getDiscountPercent} from '~/lib/pricing';

export function ProductPrice({
  price,
  compareAtPrice,
  handle,
}: {
  price?: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
  handle?: string;
}) {
  if (!price) {
    return (
      <div aria-label="Price" className="product-price" role="group">
        <span>&nbsp;</span>
      </div>
    );
  }

  const discounted = applyDiscount(price, handle);
  const isDiscounted = discounted.amount !== price.amount;

  if (isDiscounted) {
    return (
      <div aria-label="Price" className="product-price product-price-on-sale" role="group">
        <Money data={discounted} />{' '}
        <s>
          <Money data={price} />
        </s>{' '}
        <span className="price-badge">{getDiscountPercent()}%OFF</span>
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
