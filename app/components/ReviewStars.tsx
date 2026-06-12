/**
 * Judge.me 由来のレビュー評価（Shopify reviews.rating / reviews.rating_count
 * メタフィールド）を星で表示する。レビューが無い商品では何も表示しない。
 */
export function ReviewStars({
  ratingValue,
  ratingCount,
}: {
  ratingValue?: string | null; // '{"value":"5.0",...}' または '5.0'
  ratingCount?: string | null; // '3'
}) {
  const count = Number(ratingCount ?? 0);
  if (!ratingValue || !count) return null;

  let avg = 0;
  try {
    // rating 型は JSON。文字列数値で来る場合もあるため両対応
    avg = ratingValue.trim().startsWith('{')
      ? Number((JSON.parse(ratingValue) as {value?: string}).value)
      : Number(ratingValue);
  } catch {
    avg = Number(ratingValue) || 0;
  }
  if (!avg) return null;

  const full = Math.floor(avg);
  const half = avg - full >= 0.25 && avg - full < 0.75;
  const rounded = avg - full >= 0.75 ? full + 1 : full;

  return (
    <div className="review-stars" aria-label={`5段階評価で ${avg.toFixed(1)}、レビュー${count}件`}>
      <span className="review-stars-icons" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = half ? i < full : i < rounded;
          const isHalf = half && i === full;
          return (
            <span key={i} className={`review-star${filled ? ' is-filled' : ''}${isHalf ? ' is-half' : ''}`}>
              ★
            </span>
          );
        })}
      </span>
      <span className="review-stars-meta">
        {avg.toFixed(1)}（{count}件のレビュー）
      </span>
    </div>
  );
}
