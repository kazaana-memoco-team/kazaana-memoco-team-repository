// 商品ページの「スタッフからの一押しポイント」(レビュー記事)。
// BECOSコンシェルジュの吹き出し(コメント)＋レビュー記事画像(pd_<code>_N.jpg)を表示する。
// 画像もコメントも無い商品では何も描画しない。

const CONCIERGE_AVATAR =
  'https://cdn.shopify.com/s/files/1/0304/7001/3064/files/becos-concierge.jpg?v=1669773602';

export function ReviewArticle({
  images,
  concierge,
  title,
}: {
  images: string[];
  concierge: string | null;
  title: string;
}) {
  const hasImages = images && images.length > 0;
  if (!hasImages && !concierge) return null;
  return (
    <section
      className="product-review-article"
      aria-label="スタッフからの一押しポイント"
    >
      <h2 className="review-article-heading">スタッフからの一押しポイント</h2>

      {concierge && (
        <div className="review-voice">
          <figure className="review-voice-avatar">
            <img src={CONCIERGE_AVATAR} alt="BECOSコンシェルジュ" loading="lazy" />
            <figcaption>コンシェルジュ</figcaption>
          </figure>
          <div className="review-voice-bubble">
            <p>{concierge}</p>
          </div>
        </div>
      )}

      {hasImages && (
        <div className="review-article-imgs">
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`${title} の一押しポイント ${i + 1}`}
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      )}
    </section>
  );
}
