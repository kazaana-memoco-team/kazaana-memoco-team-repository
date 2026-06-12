import {useEffect, useState} from 'react';
import {Image} from '@shopify/hydrogen';
import type {ProductFragment} from 'storefrontapi.generated';

type ProductImageNode = NonNullable<
  ProductFragment['images']
>['nodes'][number];

/**
 * 商品画像ギャラリー。メイン画像＋サムネイル一覧。
 * 選択中バリアントの画像があれば、それを初期表示にする。
 */
export function ProductGallery({
  images,
  selectedImage,
  title,
}: {
  images: ProductImageNode[];
  selectedImage?: {id?: string | null; url?: string} | null;
  title: string;
}) {
  // 重複URLを除外
  const unique: ProductImageNode[] = [];
  const seen = new Set<string>();
  for (const img of images) {
    if (img?.url && !seen.has(img.url)) {
      seen.add(img.url);
      unique.push(img);
    }
  }

  const initialIndex = selectedImage?.id
    ? Math.max(
        0,
        unique.findIndex((i) => i.id === selectedImage.id),
      )
    : 0;
  const [active, setActive] = useState(initialIndex);

  // バリアント変更で選択画像が変わったら追従
  useEffect(() => {
    if (selectedImage?.id) {
      const idx = unique.findIndex((i) => i.id === selectedImage.id);
      if (idx >= 0) setActive(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImage?.id]);

  if (!unique.length) {
    return <div className="product-gallery product-gallery-empty" aria-hidden />;
  }

  const main = unique[Math.min(active, unique.length - 1)];

  return (
    <div className="product-gallery">
      <div className="product-gallery-main">
        <Image
          alt={main.altText || title}
          data={main}
          sizes="(min-width: 45em) 540px, 100vw"
          loading="eager"
        />
      </div>
      {unique.length > 1 && (
        <div className="product-gallery-thumbs" role="list">
          {unique.map((img, i) => (
            <button
              key={img.id || img.url}
              type="button"
              role="listitem"
              className={`product-gallery-thumb${i === active ? ' is-active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`画像 ${i + 1} を表示`}
            >
              <Image alt={img.altText || title} data={img} sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
