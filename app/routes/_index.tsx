import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense} from 'react';
import {Image} from '@shopify/hydrogen';
import type {
  HomeCollectionsQuery,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {MockShopNotice} from '~/components/MockShopNotice';

export const meta: Route.MetaFunction = () => {
  return [{title: 'こんにちは！ | kazaana × thebecos'}];
};

export async function loader(args: Route.LoaderArgs) {
  // 認証チェック
  const {requireAuth} = await import('~/lib/auth');
  await requireAuth(args.request, args.context.env);

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
async function loadCriticalData({context}: Route.LoaderArgs) {
  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  const homeCollections = context.storefront
    .query(HOME_COLLECTIONS_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  return {
    recommendedProducts,
    homeCollections,
  };
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home">
      {data.isShopLinked ? null : <MockShopNotice />}
      <Hero />
      <FeaturedCategories collections={data.homeCollections} />
      <RecommendedProducts products={data.recommendedProducts} />
    </div>
  );
}

function Hero() {
  return (
    <section
      style={{
        padding: '80px 24px',
        textAlign: 'center',
        background: '#000',
        color: '#fff',
        borderRadius: '12px',
        marginBottom: '32px',
      }}
    >
      <h1 style={{fontSize: '56px', margin: 0, letterSpacing: '0.05em'}}>
        こんにちは！
      </h1>
      <p style={{margin: '20px 0 36px', fontSize: '18px', opacity: 0.85}}>
        伝統工芸品を<strong>30%OFF</strong>の特別価格で。
      </p>
      <Link
        to="/collections/all"
        style={{
          display: 'inline-block',
          padding: '14px 36px',
          background: '#fff',
          color: '#000',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          fontSize: '16px',
        }}
      >
        商品一覧を見る →
      </Link>
    </section>
  );
}

function FeaturedCategories({
  collections,
}: {
  collections: Promise<HomeCollectionsQuery | null>;
}) {
  return (
    <section
      aria-labelledby="featured-categories"
      style={{marginBottom: '48px'}}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h2 id="featured-categories" style={{margin: 0}}>
          カテゴリから探す
        </h2>
        <Link to="/collections" style={{fontSize: '14px'}}>
          すべて見る →
        </Link>
      </header>
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={collections}>
          {(response) =>
            response?.collections?.nodes?.length ? (
              <div className="collections-grid">
                {response.collections.nodes.slice(0, 6).map((collection) => (
                  <Link
                    key={collection.id}
                    to={`/collections/${collection.handle}`}
                    className="collection-item"
                    prefetch="intent"
                  >
                    <div className="collection-item-thumb">
                      {collection.image ? (
                        <Image
                          data={collection.image}
                          aspectRatio="1/1"
                          sizes="(min-width: 45em) 200px, 50vw"
                          alt={collection.image.altText || collection.title}
                        />
                      ) : (
                        <span className="collection-item-fallback">
                          {collection.title}
                        </span>
                      )}
                    </div>
                    <h5 className="collection-item-title">
                      {collection.title}
                    </h5>
                  </Link>
                ))}
              </div>
            ) : null
          }
        </Await>
      </Suspense>
    </section>
  );
}

function RecommendedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <section
      className="recommended-products"
      aria-labelledby="recommended-products"
    >
      <h2 id="recommended-products">Recommended Products</h2>
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {(response) => (
            <div className="recommended-products-grid">
              {response
                ? response.products.nodes.map((product) => (
                    <ProductItem key={product.id} product={product} />
                  ))
                : null}
            </div>
          )}
        </Await>
      </Suspense>
      <br />
    </section>
  );
}

const HOME_COLLECTIONS_QUERY = `#graphql
  fragment HomeCollection on Collection {
    id
    title
    handle
    image {
      id
      url
      altText
      width
      height
    }
  }
  query HomeCollections($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 12, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...HomeCollection
      }
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 4, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
