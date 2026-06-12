import {Link} from 'react-router';
import type {Route} from './+types/service-guide';

export const meta: Route.MetaFunction = () => [
  {title: 'JAPAN BENEFITS サービス紹介資料｜日本の本物を、福利厚生に。'},
  {
    name: 'description',
    content:
      '法人向け福利厚生サービス「JAPAN BENEFITS produced by BECOS」のサービス紹介資料。サービス概要・対象範囲・ご利用の流れ・料金・運営会社をまとめています。',
  },
];

// 公開資料（価格は会員特別価格を含まない。サブスク料金のみ掲載）
export default function ServiceGuidePage() {
  return (
    <div className="guide">
      <div className="guide-toolbar">
        <Link to="/" className="guide-back">
          ← トップへ
        </Link>
        <button
          type="button"
          className="guide-print"
          onClick={() => {
            if (typeof window !== 'undefined') window.print();
          }}
        >
          印刷 / PDFで保存
        </button>
      </div>

      {/* 表紙 */}
      <section className="guide-cover">
        <p className="guide-cover-brand">JAPAN BENEFITS produced by BECOS</p>
        <h1>
          日本の本物を、
          <br />
          会社の福利厚生に。
        </h1>
        <p className="guide-cover-sub">サービス紹介資料</p>
      </section>

      {/* 課題提起 */}
      <GuideSection n="01" title="こんな課題はありませんか？">
        <ul className="guide-list">
          <li>福利厚生がありきたりで、従業員に響いていない</li>
          <li>物価高で、実質的な手取りが目減りしている</li>
          <li>採用・定着の決め手に欠ける</li>
          <li>制度を入れても使われず、形骸化してしまう</li>
        </ul>
        <p className="guide-lead">
          <strong>JAPAN BENEFITS</strong> は、日本全国の“本物”の工芸品・日本製品を、従業員とそのご家族に
          会員特別価格でお届けする、記憶に残る福利厚生です。
        </p>
      </GuideSection>

      {/* 3つの価値 */}
      <GuideSection n="02" title="JAPAN BENEFITS の3つの価値">
        <div className="guide-cards">
          <div className="guide-card">
            <h3>ここだけの会員特別価格</h3>
            <p>全国の職人と直接つながるBECOSだから実現できる、会員だけの特別価格。一般には公開されない価格で本物をお求めいただけます。</p>
          </div>
          <div className="guide-card">
            <h3>2親等以内のご家族まで</h3>
            <p>従業員ご本人に加え、配偶者・お子様・ご両親・ご兄弟・祖父母・お孫様まで。ご家族それぞれのアカウントでご利用いただけます。</p>
          </div>
          <div className="guide-card">
            <h3>作り手から、産地直送の心で</h3>
            <p>有田焼・江戸切子・西陣織・金沢箔ほか、日本全国の伝統工芸が対象。今後はグルメ・体験へも拡大予定です。</p>
          </div>
        </div>
      </GuideSection>

      {/* 対象範囲 */}
      <GuideSection n="03" title="ご利用いただける範囲">
        <p className="guide-lead">
          従業員ご本人と、その<strong>2親等以内のご家族</strong>（配偶者・子・父母・兄弟姉妹・祖父母・孫、ならびに配偶者の同範囲のご家族）。
          ご家族は従業員ご本人がマイページから招待でき、続柄を登録します。従業員が退職された場合、紐づくご家族のご利用資格も終了します。
        </p>
      </GuideSection>

      {/* 取扱商品 */}
      <GuideSection n="04" title="取扱商品">
        <p className="guide-lead">
          全国<strong>300工房</strong>以上と直接取引、<strong>1万点以上</strong>の本物の日本製品を取扱い。
        </p>
        <ul className="guide-list guide-list-cols">
          <li>有田焼・波佐見焼などの器</li>
          <li>江戸切子・薩摩切子のガラス</li>
          <li>西陣織・今治タオルなどの布</li>
          <li>金沢箔の漆器・酒器</li>
          <li>南部鉄器・刃物・木工</li>
          <li>名入れ・ラッピング等のギフト対応</li>
        </ul>
      </GuideSection>

      {/* ご利用の流れ */}
      <GuideSection n="05" title="ご利用の流れ">
        <ol className="guide-steps">
          <li>
            <span className="guide-step-num">1</span>
            <div>
              <h3>法人契約</h3>
              <p>従業員数に応じた定額プランをお選びいただきます。最短即日で開始できます。</p>
            </div>
          </li>
          <li>
            <span className="guide-step-num">2</span>
            <div>
              <h3>従業員を招待</h3>
              <p>管理画面から従業員のメールアドレスを入れるだけ（CSV一括も可）。ご家族は従業員ご本人が招待します。</p>
            </div>
          </li>
          <li>
            <span className="guide-step-num">3</span>
            <div>
              <h3>会員価格でお買い物</h3>
              <p>決済・配送は運営元BECOSの安心インフラを利用。お届け先は複数登録でき、贈り物にも便利です。</p>
            </div>
          </li>
        </ol>
      </GuideSection>

      {/* 管理者の運用 */}
      <GuideSection n="06" title="管理者の運用（工数ゼロ）">
        <ul className="guide-list">
          <li>導入も運用も<strong>メール招待だけ</strong>。専任担当は不要です。</li>
          <li>ダッシュボードで<strong>登録率・利用状況・利用効果</strong>を把握（個人の購入内容は非開示でプライバシーに配慮）。</li>
          <li>請求書払いに対応。運用の手間をかけずに福利厚生を提供できます。</li>
        </ul>
      </GuideSection>

      {/* 料金プラン */}
      <GuideSection n="07" title="料金プラン">
        <table className="guide-table">
          <thead>
            <tr>
              <th>プラン</th>
              <th>従業員数</th>
              <th>月額（税抜）</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>S</td><td>〜30名</td><td>¥19,800</td></tr>
            <tr><td>M</td><td>〜100名</td><td>¥39,800</td></tr>
            <tr><td>L</td><td>〜300名</td><td>¥79,800</td></tr>
            <tr><td>XL</td><td>301名〜</td><td>個別お見積り</td></tr>
          </tbody>
        </table>
        <p className="guide-note">
          入会金 50,000円（税別）／年間一括前払い（請求書払い）。商品購入時の追加マージンはありません。
          <br />
          <strong>ファウンディングメンバー（先行30社）は初年度50%OFF＋入会金無料</strong>でご案内中です。
        </p>
      </GuideSection>

      {/* 税制 */}
      <GuideSection n="08" title="税制・経費化のポイント">
        <p className="guide-lead">
          福利厚生としての要件を満たす形で全従業員に機会を提供するため、<strong>月額・年額のご利用料金は福利厚生費として計上いただける</strong>ものと考えられます。
          具体的な税務処理は、自社の状況に応じて顧問税理士等にご確認ください。
        </p>
      </GuideSection>

      {/* 運営の信頼 */}
      <GuideSection n="09" title="運営の信頼">
        <p className="guide-lead">
          JAPAN BENEFITS は、伝統工芸のオンラインストア<strong>「BECOS」</strong>がプロデュース。商品の品質・決済・配送は、すべてBECOSの実績あるインフラをそのまま利用します。
        </p>
        <ul className="guide-list guide-list-cols">
          <li>全国の工房と直接取引（有田焼・江戸切子・西陣織・金沢箔ほか）</li>
          <li>本物の日本製品を多数取扱い</li>
          <li>メディア掲載：日本経済新聞・テレビ東京・JTB・西日本新聞社・地球の歩き方 ほか</li>
          <li>Shopify決済／全国配送に対応</li>
        </ul>
      </GuideSection>

      {/* FAQ */}
      <GuideSection n="10" title="よくあるご質問">
        <dl className="guide-faq">
          <dt>最低何名から導入できますか？</dt>
          <dd>Sプラン（〜30名）からご利用いただけます。人数に応じてプランをお選びください。</dd>
          <dt>運用に手間はかかりますか？</dt>
          <dd>メール招待だけで開始でき、専任担当は不要です。</dd>
          <dt>解約はできますか？</dt>
          <dd>1年契約・自動更新です。詳細は導入のご相談時にご案内します。</dd>
          <dt>家族はどこまで利用できますか？</dt>
          <dd>従業員ご本人の2親等以内のご家族までご利用いただけます。</dd>
          <dt>決済や配送は安全ですか？</dt>
          <dd>運営元BECOSのShopify決済・配送インフラをそのまま利用します。</dd>
        </dl>
      </GuideSection>

      {/* CTA / お問い合わせ */}
      <section className="guide-cta">
        <h2>導入のご相談・お見積り</h2>
        <p>まずはお気軽にご相談ください。ファウンディングメンバー（先行30社・初年度50%OFF）も募集中です。</p>
        <div className="guide-cta-row">
          <a className="lp-btn lp-btn-primary" href="/contact">
            導入のご相談（無料）
          </a>
          <a className="lp-btn lp-btn-gold" href="/contact?type=document">
            資料を受け取る（無料）
          </a>
        </div>
        <p className="guide-contact">
          📧 support@japan-benefits.jp ／ 📞 050-3177-4147
          <br />
          株式会社KAZAANA　〒104-0031 東京都中央区京橋1-1-5 セントラルビル2階
        </p>
      </section>
    </div>
  );
}

function GuideSection({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="guide-section">
      <h2>
        <span className="guide-section-n">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
