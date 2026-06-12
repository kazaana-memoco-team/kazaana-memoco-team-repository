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

// 法人問い合わせ窓口（専用アドレス/フォーム開設後に差し替える）
const CONTACT_EMAIL = 'k-kashimura@kazaana.co.jp';

// 作成中・テスト用コレクションをトップに出さない
const HIDDEN_COLLECTION_PATTERN = /作成中|テスト|test/i;

function visibleCollections<T extends {title: string}>(nodes: T[]): T[] {
  return nodes.filter((c) => !HIDDEN_COLLECTION_PATTERN.test(c.title));
}
const CONTACT_SUBJECT = encodeURIComponent(
  'JAPAN BENEFITS 導入のご相談（ファウンディングメンバー）',
);

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {
      title: data?.isMember
        ? 'ホーム | JAPAN BENEFITS'
        : 'JAPAN BENEFITS produced by BECOS｜日本の本物を、福利厚生に。',
    },
    {
      name: 'description',
      content:
        '日本全国の伝統工芸を、従業員とそのご家族に会員特別価格でお届けする法人向け福利厚生サービス。BECOSプロデュース。',
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // 公開LPのため認証必須にはしない。会員かどうかで出し分ける
  const {getAuthUser} = await import('~/lib/auth');
  const user = await getAuthUser(args.request, args.context.env);
  const isMember = Boolean(user);

  const deferredData = loadDeferredData(args, isMember);
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData, isMember};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  // LPの社会的証明: 会員の累計割引額・先行30社の残枠（個人情報は扱わない集計のみ）
  const social = await loadSocialProof(context).catch(() => ({
    totalSavings: 0,
    foundingRemaining: 30,
  }));
  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
    ...social,
  };
}

const FOUNDING_TOTAL = 30;

async function loadSocialProof(context: Route.LoaderArgs['context']) {
  const {createSupabaseAdmin} = await import('~/lib/supabase');
  const supabase = createSupabaseAdmin(context.env);
  const [{data: orders}, {count: companyCount}] = await Promise.all([
    supabase
      .from('orders')
      .select('total_regular_price, total_member_price')
      .eq('status', 'paid'),
    supabase.from('companies').select('id', {count: 'exact', head: true}),
  ]);
  const totalSavings = (orders ?? []).reduce(
    (sum, o) =>
      sum + Math.max(0, (o.total_regular_price ?? 0) - (o.total_member_price ?? 0)),
    0,
  );
  const foundingRemaining = Math.max(0, FOUNDING_TOTAL - (companyCount ?? 0));
  return {totalSavings, foundingRemaining};
}

function loadDeferredData({context}: Route.LoaderArgs, isMember: boolean) {
  // 商品（価格を含む）は会員のみ取得。公開LPはカテゴリ画像のみ使う
  const recommendedProducts = isMember
    ? context.storefront.query(RECOMMENDED_PRODUCTS_QUERY).catch((error: Error) => {
        console.error(error);
        return null;
      })
    : Promise.resolve(null);

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

  if (!data.isMember) {
    return (
      <PublicLanding
        collections={data.homeCollections}
        totalSavings={data.totalSavings}
        foundingRemaining={data.foundingRemaining}
      />
    );
  }

  return (
    <div className="home">
      {data.isShopLinked ? null : <MockShopNotice />}
      <MemberHero />
      <FeaturedCategories collections={data.homeCollections} />
      <RecommendedProducts products={data.recommendedProducts} />
    </div>
  );
}

/* ============================================================
 * 会員ホーム（ログイン後）— 検索ファースト
 * ============================================================ */

function MemberHero() {
  return (
    <section className="member-hero">
      <h1>日本の本物と、暮らす歓び。</h1>
      <p>すべての商品を、会員特別価格でお買い求めいただけます。</p>
      <form action="/search" method="get" className="member-hero-search" role="search">
        <input
          type="search"
          name="q"
          placeholder="商品名・キーワードで探す（例: 江戸切子、夫婦箸）"
          aria-label="商品を検索"
        />
        <button type="submit">検索</button>
      </form>
      <div className="member-hero-links">
        <Link to="/collections">カテゴリから探す</Link>
        <Link to="/collections/all">商品一覧を見る</Link>
        <Link to="/mypage">注文履歴</Link>
      </div>
    </section>
  );
}

function FeaturedCategories({
  collections,
}: {
  collections: Promise<HomeCollectionsQuery | null>;
}) {
  return (
    <section aria-labelledby="featured-categories" style={{marginBottom: '48px'}}>
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
                {visibleCollections(response.collections.nodes)
                  .slice(0, 6)
                  .map((collection) => (
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
                    <h5 className="collection-item-title">{collection.title}</h5>
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
    <section className="recommended-products" aria-labelledby="recommended-products">
      <h2 id="recommended-products">おすすめ商品</h2>
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

/* ============================================================
 * 公開LP（未ログイン）— サービス紹介
 * 価格情報（割引率・会員価格）はここでは一切表示しない
 * ============================================================ */

function PublicLanding({
  collections,
  totalSavings,
  foundingRemaining,
}: {
  collections: Promise<HomeCollectionsQuery | null>;
  totalSavings: number;
  foundingRemaining: number;
}) {
  return (
    <div className="lp">
      {/* ヒーロー */}
      <section className="lp-hero">
        <p className="lp-hero-brand">JAPAN BENEFITS produced by BECOS</p>
        <h1>
          日本の本物が、
          <br />
          ぜんぶ会員特別価格。
        </h1>
        <p className="lp-hero-sub">
          ありきたりな福利厚生から、“本物”が届く福利厚生へ。
          <br />
          日本全国の工芸品・日本製品を、従業員とそのご家族に会員特別価格で。
        </p>
        {/* 社会的証明: 累計割引額（一定額を超えたら表示） */}
        {totalSavings >= 100000 && (
          <p className="lp-hero-proof">
            会員はこれまで累計{' '}
            <strong>¥{totalSavings.toLocaleString('ja-JP')}</strong> 分、
            おトクにお買い物しています
          </p>
        )}
        <div className="lp-cta-row">
          <a
            className="lp-btn lp-btn-primary"
            href="/contact"
          >
            導入のご相談（無料）
          </a>
          <Link className="lp-btn lp-btn-ghost" to="/login">
            会員の方はログイン
          </Link>
        </div>
        <p className="lp-hero-note">※ 会員特別価格はログイン後にのみ表示されます</p>
      </section>

      {/* 課題提起（HR・経営者向け） */}
      <section className="lp-section lp-section-gray lp-problem">
        <h2>その福利厚生、ちゃんと使われていますか？</h2>
        <div className="lp-problem-grid">
          <div className="lp-problem-card">
            <span className="lp-problem-icon">？</span>
            <p>
              ありきたりで、
              <br />
              従業員に響いていない
            </p>
          </div>
          <div className="lp-problem-card">
            <span className="lp-problem-icon">↓</span>
            <p>
              物価高で、
              <br />
              実質的な手取りが目減り
            </p>
          </div>
          <div className="lp-problem-card">
            <span className="lp-problem-icon">…</span>
            <p>
              採用・定着の
              <br />
              決め手に欠ける
            </p>
          </div>
        </div>
        <p className="lp-problem-solution">
          <strong>JAPAN BENEFITS</strong> なら、日本の“本物”を会員特別価格で。
          ご家族まで使える、<strong>記憶に残る福利厚生</strong>です。
        </p>
      </section>

      {/* 3つの価値 */}
      <section className="lp-section">
        <h2>JAPAN BENEFITS の3つの価値</h2>
        <div className="lp-features">
          <div className="lp-feature">
            <div className="lp-feature-icon">特別価格</div>
            <h3>ほぼ原価の会員特別価格</h3>
            <p>
              全国の職人と直接つながるBECOSだから実現できる、会員だけの特別価格。
              一般には公開されない価格で、本物の工芸品をお求めいただけます。
            </p>
          </div>
          <div className="lp-feature">
            <div className="lp-feature-icon">家族もOK</div>
            <h3>2親等以内のご家族まで</h3>
            <p>
              従業員ご本人に加え、配偶者・お子様・ご両親・ご兄弟・祖父母・お孫様まで。
              ご家族それぞれのアカウントでご利用いただけます。
            </p>
          </div>
          <div className="lp-feature">
            <div className="lp-feature-icon">日本の本物</div>
            <h3>全国の工房から、直送</h3>
            <p>
              有田焼、江戸切子、西陣織、金沢箔——日本全国の伝統工芸が対象。
              今後は日本のこだわりグルメ・体験へも拡大予定です。
            </p>
          </div>
        </div>
      </section>

      {/* 運営元の信頼 */}
      <section className="lp-section lp-section-gray lp-trust">
        <h2>運営は、日本全国の工房とつながる工芸品EC「BECOS」</h2>
        <p className="lp-trust-lead">
          JAPAN BENEFITS は、伝統工芸のオンラインストア「BECOS」がプロデュース。
          商品の品質・決済・配送は、すべてBECOSの実績あるインフラをそのまま利用します。
        </p>
        <div className="lp-trust-points">
          <div>
            <strong>全国の工房と直接取引</strong>
            <span>有田焼・江戸切子・西陣織・金沢箔ほか</span>
          </div>
          <div>
            <strong>本物の日本製品を多数取扱い</strong>
            <span>工芸品から、今後はグルメ・体験まで拡大</span>
          </div>
          <div>
            <strong>安心の決済・配送インフラ</strong>
            <span>Shopify決済／全国配送に対応</span>
          </div>
        </div>
      </section>

      {/* ご利用の流れ */}
      <section className="lp-section">
        <h2>ご利用の流れ</h2>
        <ol className="lp-steps">
          <li>
            <span className="lp-step-num">1</span>
            <h3>法人契約</h3>
            <p>従業員数に応じた月額定額。最短即日でご利用開始できます。</p>
          </li>
          <li>
            <span className="lp-step-num">2</span>
            <h3>従業員を招待</h3>
            <p>管理画面からメールアドレスを入れるだけ。ご家族の招待も簡単です。</p>
          </li>
          <li>
            <span className="lp-step-num">3</span>
            <h3>会員価格でお買い物</h3>
            <p>
              決済・配送は運営元BECOS（thebecos.com）の安心インフラをそのまま利用します。
            </p>
          </li>
        </ol>
      </section>

      {/* カテゴリビジュアル（価格なし） */}
      <section className="lp-section">
        <h2>こんな「日本の本物」に出会えます</h2>
        <Suspense fallback={null}>
          <Await resolve={collections}>
            {(response) =>
              response?.collections?.nodes?.length ? (
                <div className="collections-grid">
                  {visibleCollections(response.collections.nodes)
                    .slice(0, 6)
                    .map((collection) => (
                    <div key={collection.id} className="collection-item">
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
                      <h5 className="collection-item-title">{collection.title}</h5>
                    </div>
                  ))}
                </div>
              ) : null
            }
          </Await>
        </Suspense>
        <p className="lp-note">※ 商品と会員特別価格は、ログイン後にご覧いただけます</p>
      </section>

      {/* 利用シーン */}
      <section className="lp-section lp-section-gray">
        <h2>こんなシーンで使われています</h2>
        <div className="lp-scenes">
          <div className="lp-scene">
            <h3>誕生日・勤続記念に</h3>
            <p>会社からの贈り物を、物語のある工芸品で。</p>
          </div>
          <div className="lp-scene">
            <h3>結婚・出産のお祝いに</h3>
            <p>ご家族の節目に、一生ものの逸品を会員価格で。</p>
          </div>
          <div className="lp-scene">
            <h3>周年記念品・取引先への贈答に</h3>
            <p>法人の一括購買も会員価格。1案件で年会費の元が取れます。</p>
          </div>
          <div className="lp-scene">
            <h3>お中元・お歳暮に</h3>
            <p>季節のご挨拶を、日本の本物で特別に。</p>
          </div>
        </div>
      </section>

      {/* 料金プラン */}
      <section className="lp-section" id="plans">
        <h2>料金プラン</h2>
        <p className="lp-plans-lead">
          従業員数で決まるシンプルな月額定額。商品購入時の追加マージンはありません。
        </p>
        <div className="lp-plans">
          <div className="lp-plan">
            <h3>S</h3>
            <p className="lp-plan-size">従業員 〜30名</p>
            <p className="lp-plan-price">
              ¥19,800<span>/月（税抜）</span>
            </p>
          </div>
          <div className="lp-plan">
            <h3>M</h3>
            <p className="lp-plan-size">従業員 〜100名</p>
            <p className="lp-plan-price">
              ¥39,800<span>/月（税抜）</span>
            </p>
          </div>
          <div className="lp-plan">
            <h3>L</h3>
            <p className="lp-plan-size">従業員 〜300名</p>
            <p className="lp-plan-price">
              ¥79,800<span>/月（税抜）</span>
            </p>
          </div>
          <div className="lp-plan">
            <h3>XL</h3>
            <p className="lp-plan-size">従業員 301名〜</p>
            <p className="lp-plan-price lp-plan-price-custom">個別お見積り</p>
          </div>
        </div>
        <p className="lp-note">
          年間一括前払い（請求書払い）。月払いオプション・入会金についてはお問い合わせください。
        </p>
        <div className="lp-founding">
          <h3>ファウンディングメンバー募集中</h3>
          {foundingRemaining > 0 ? (
            <p className="lp-founding-slots">
              先行30社限定 ／ <strong>残り {foundingRemaining} 社</strong>
            </p>
          ) : (
            <p className="lp-founding-slots">先行30社の募集は終了しました</p>
          )}
          <p>
            先行30社限定で、<strong>初年度50%OFF＋入会金無料</strong>
            にてご案内しています。導入事例づくりにご協力いただける企業様を募集しています。
          </p>
          <a
            className="lp-btn lp-btn-primary"
            href="/contact"
          >
            ファウンディングメンバーに応募する
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section lp-section-gray">
        <h2>よくあるご質問</h2>
        <dl className="lp-faq">
          <dt>商品の価格が表示されません</dt>
          <dd>
            会員特別価格は契約企業の会員様だけにご提供しているため、ログイン後にのみ表示されます。
          </dd>
          <dt>家族はどこまで利用できますか？</dt>
          <dd>
            従業員ご本人の2親等以内（配偶者・子・親・兄弟姉妹・祖父母・孫）までご利用いただけます。
          </dd>
          <dt>決済や配送は安全ですか？</dt>
          <dd>
            運営元BECOS（thebecos.com）のShopify決済・配送インフラをそのまま利用します。お支払いはクレジットカード等に対応しています。
          </dd>
          <dt>契約期間・解約について教えてください</dt>
          <dd>
            1年契約・自動更新です。詳細は導入のご相談時にご案内いたします。
          </dd>
        </dl>
      </section>

      {/* 最終CTA */}
      <section className="lp-final-cta">
        <h2>日本の本物を、あなたの会社の福利厚生に。</h2>
        <div className="lp-cta-row">
          <a
            className="lp-btn lp-btn-primary"
            href="/contact"
          >
            導入のご相談（無料）
          </a>
          <Link className="lp-btn lp-btn-ghost" to="/login">
            会員の方はログイン
          </Link>
        </div>
      </section>
    </div>
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
