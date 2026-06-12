import {Link} from 'react-router';
import type {Route} from './+types/policies.tokushoho';

export const meta: Route.MetaFunction = () => [
  {title: 'JAPAN BENEFITS｜特定商取引法に基づく表示'},
];

const ROWS: Array<{label: string; content: React.ReactNode}> = [
  {label: '販売業者', content: '株式会社KAZAANA'},
  {label: '運営統括責任者', content: '代表取締役 樫村健太郎'},
  {label: '所在地', content: '〒104-0031 東京都中央区京橋1-1-5 セントラルビル2階'},
  {
    label: '電話番号',
    content:
      '050-3177-4147（受付時間: 平日10:00〜17:00）※サービス・注文に関するお問い合わせは、記録保持のため原則として電子メールにて承ります',
  },
  {
    label: 'メールアドレス',
    content: 'support-japan-benefits@thebecos.com（24時間受付）',
  },
  {label: 'サイトURL', content: 'https://japan-benefits.jp'},
  {
    label: '販売価格',
    content:
      '各商品ページに表示する会員特別価格（表示価格は消費税を含みます）',
  },
  {
    label: '商品代金以外の必要料金',
    content: (
      <>
        ・送料（金額は注文手続き画面および各商品ページに表示されます）
        <br />
        ・インターネット接続料金その他の電気通信回線の通信料金（お客様のご負担となります）
      </>
    ),
  },
  {
    label: '支払方法',
    content:
      'クレジットカード、その他注文画面に表示される決済方法（Shopifyペイメント等）',
  },
  {
    label: '支払時期',
    content:
      '商品注文確定時（クレジットカード決済の場合は、各カード会社の引き落とし日となります）',
  },
  {
    label: '商品の引渡時期（サービスの提供時期）',
    content: (
      <>
        <strong>【物品（工芸品・食品等）】</strong>
        <br />
        原則として注文確定後、各商品ページに記載の納期・引渡時期に従い発送いたします。受注製作品、名入れ品、在庫切れ商品等については、各商品ページに記載の納期によります。
        <br />
        <br />
        <strong>【体験チケット等（デジタルコンテンツ含む）】</strong>
        <br />
        注文確定後、即時〜数営業日以内に、電子メールでの送付またはシステム上での発行により引き渡します。
      </>
    ),
  },
  {
    label: '返品・交換・キャンセル',
    content: (
      <>
        <strong>1. 不良品・誤配送の場合</strong>
        <br />
        商品到着後（体験チケット等の場合は発行後）7日以内に限り、良品との交換または返品・返金に応じます。この場合の返品送料や手数料は当社が負担いたします。
        <br />
        <br />
        <strong>2. お客様都合による返品・キャンセル</strong>
        <br />
        ・原則として、注文確定後のお客様都合による返品、交換、キャンセルはお受けできません。
        <br />
        ・ただし、出荷手配前（体験チケット等の場合は発行手配前）の段階に限り、注文のキャンセルが可能な場合があります。
        <br />
        ・
        <strong>
          受注製作品、名入れ品、食品・飲料等の生鮮品、および体験チケット等、その性質上返品・キャンセルが困難なものとして各商品ページに明記された商品については、注文確定後のキャンセルおよび返品・交換は一切できません。
        </strong>
      </>
    ),
  },
  {
    label: '会員資格・利用条件',
    content:
      '本サービスは、当社と法人利用契約を締結した企業の役員、従業員、関係者等、およびその2親等以内の親族のみが利用できる会員制福利厚生サービスです。詳細は会員利用規約をご確認ください。',
  },
  {
    label: 'ソフトウェアの動作環境',
    content:
      'Google Chrome／Apple Safari／Mozilla Firefox／Microsoft Edge（各最新版）。CookieおよびJavaScriptが有効である必要があります。',
  },
];

export default function TokushohoPage() {
  return (
    <div className="policy-page">
      <p className="policy-back">
        <Link to="/policies">← 各種ポリシー</Link>
      </p>
      <h1>特定商取引法に基づく表示</h1>
      <table className="policy-table">
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th>{r.label}</th>
              <td>{r.content}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="policy-meta">
        ※ 法人向けサービス利用契約（月額利用料）に関するお問い合わせも上記連絡先で承ります。
      </p>
    </div>
  );
}
