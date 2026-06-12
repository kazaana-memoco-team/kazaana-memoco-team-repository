import {Suspense} from 'react';
import {redirect, useLoaderData, Await} from 'react-router';
import type {Route} from './+types/products.$handle';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery} from '~/components/ProductGallery';
import {ReviewStars} from '~/components/ReviewStars';
import {ReviewArticle} from '~/components/ReviewArticle';
import {ProductForm} from '~/components/ProductForm';
import {stockStatus, type InventoryStatus} from '~/lib/inventory';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {title: `${data?.product.title ?? ''} | JAPAN BENEFITS`},
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const {requireAuth} = await import('~/lib/auth');
  await requireAuth(args.request, args.context.env);

  // 出品停止商品は表示しない（管理画面 /admin/exclusions で設定）
  if (args.params.handle) {
    const {getExclusionSet} = await import('~/lib/exclusions');
    const excluded = await getExclusionSet(args.context.env);
    if (excluded.has(args.params.handle)) {
      throw new Response('Not Found', {status: 404});
    }
  }

  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const {getProductInventory} = await import('~/lib/inventory');
  const [{product}, inventory] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    getProductInventory(context.env, handle),
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  return {
    product,
    inventory,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: Route.LoaderArgs) {
  // レビュー記事(スタッフからの一押しポイント)は非クリティカル。deferredで取得し
  // ページ描画をブロックしない。失敗時は空。
  const handle = params.handle;
  const review = handle
    ? import('~/lib/reviews')
        .then(({getReviewContent}) => getReviewContent(context.env, handle))
        .catch(() => ({images: [], concierge: null}))
    : Promise.resolve({images: [], concierge: null});

  return {review};
}

export default function Product() {
  const {product, inventory, review} = useLoaderData<typeof loader>();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml} = product;

  return (
    <>
    <div className="product">
      <ProductGallery
        images={product.images?.nodes ?? []}
        selectedImage={selectedVariant?.image}
        title={title}
      />
      <div className="product-main">
        <h1>{title}</h1>
        <ReviewStars
          ratingValue={product.rating?.value}
          ratingCount={product.ratingCount?.value}
        />
        <ProductPrice
          price={selectedVariant?.price}
          compareAtPrice={selectedVariant?.compareAtPrice}
          handle={product.handle}
        />
        <StockBadge status={stockStatus(inventory[selectedVariant?.sku ?? ''])} />
        <br />
        <ProductForm
          productOptions={productOptions}
          selectedVariant={selectedVariant}
        />
        <br />
        <br />
        <p>
          <strong>商品説明</strong>
        </p>
        <br />
        <div className="product-description" dangerouslySetInnerHTML={{__html: descriptionHtml}} />
        <br />
      </div>
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>

    {/* スタッフからの一押しポイント(レビュー記事)— 非クリティカル・全幅 */}
    <Suspense fallback={null}>
      <Await resolve={review} errorElement={null}>
        {(r) => (
          <ReviewArticle
            images={r?.images ?? []}
            concierge={r?.concierge ?? null}
            title={title}
          />
        )}
      </Await>
    </Suspense>
    </>
  );
}

function StockBadge({status}: {status: InventoryStatus}) {
  const map: Record<
    InventoryStatus,
    {label: string; sub: string; cls: string}
  > = {
    in_stock: {
      label: '在庫あり',
      sub: '2営業日以内に発送します',
      cls: 'stock-badge-in',
    },
    made_to_order: {
      label: 'お取り寄せ／受注製作',
      sub: '納期は別途ご案内します（商品説明の納期をご確認ください）',
      cls: 'stock-badge-order',
    },
    out_of_stock: {
      label: '在庫切れ',
      sub: '再入荷までお待ちください',
      cls: 'stock-badge-out',
    },
  };
  const s = map[status];
  return (
    <p className={`stock-badge ${s.cls}`}>
      <span className="stock-badge-dot" aria-hidden />
      <span className="stock-badge-label">{s.label}</span>
      <span className="stock-badge-sub">{s.sub}</span>
    </p>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    images(first: 12) {
      nodes {
        __typename
        id
        url
        altText
        width
        height
      }
    }
    rating: metafield(namespace: "reviews", key: "rating") {
      value
    }
    ratingCount: metafield(namespace: "reviews", key: "rating_count") {
      value
    }
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;
