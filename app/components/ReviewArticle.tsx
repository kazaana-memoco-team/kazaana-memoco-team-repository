// 商品ページの「スタッフの一押しポイント」(レビュー記事)。
// BECOS-JP のレビュー記事画像(pd_<code>_N.jpg)を縦並びで表示する。
// 画像が無い商品では何も描画しない。

export function ReviewArticle({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  if (!images || images.length === 0) return null;
  return (
    <section className="product-review-article" aria-label="スタッフの一押しポイント">
      <h2 className="review-article-heading">スタッフの一押しポイント</h2>
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
    </section>
  );
}
