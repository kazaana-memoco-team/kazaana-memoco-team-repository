import {useState} from 'react';
import {Form, useActionData, useNavigation, useLoaderData, Link} from 'react-router';
import {createSupabaseAdmin} from '~/lib/supabase';
import type {Route} from './+types/contact';

export const meta: Route.MetaFunction = ({data}) => {
  const isDoc = data?.isDocument;
  return [
    {title: isDoc ? 'JAPAN BENEFITS｜資料請求' : 'JAPAN BENEFITS｜導入のご相談'},
    {
      name: 'description',
      content:
        '法人向け福利厚生サービス「JAPAN BENEFITS produced by BECOS」の導入相談・資料請求フォーム。',
    },
  ];
};

// ?type=document で「資料請求」モードに切り替える
export async function loader({request}: Route.LoaderArgs) {
  const url = new URL(request.url);
  return {isDocument: url.searchParams.get('type') === 'document'};
}

type ActionData = {error?: string; ok?: boolean};

export async function action({request, context}: Route.ActionArgs): Promise<ActionData> {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const companyName = String(form.get('company_name') ?? '').trim();
  const contactName = String(form.get('contact_name') ?? '').trim();

  if (!email || !contactName) {
    return {error: 'お名前とメールアドレスは必須です。'};
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return {error: 'メールアドレスの形式が正しくありません。'};
  }

  const inquiryType = String(form.get('inquiry_type') ?? '導入相談').trim() || '導入相談';
  const rawMessage = String(form.get('message') ?? '').trim();
  const storedMessage =
    [`【種別】${inquiryType}`, rawMessage].filter(Boolean).join('\n') || null;

  const supabase = createSupabaseAdmin(context.env);
  const {error} = await supabase.from('contact_inquiries').insert({
    company_name: companyName || null,
    contact_name: contactName,
    email,
    phone: String(form.get('phone') ?? '').trim() || null,
    employee_count: String(form.get('employee_count') ?? '').trim() || null,
    message: storedMessage,
  });

  if (error) {
    console.error('[contact] insert failed:', error.message);
    return {error: '送信に失敗しました。時間をおいて再度お試しください。'};
  }

  // 通知メールはベストエフォート（RESEND_API_KEY 未設定なら送信のみスキップ）
  try {
    const apiKey = (context.env as any).RESEND_API_KEY as string | undefined;
    if (apiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'JAPAN BENEFITS <noreply-japan-benefits@thebecos.com>',
          to: ['k-kashimura@kazaana.co.jp'],
          subject: `【${inquiryType}】${companyName || '個人'} / ${contactName} 様`,
          text: `種別: ${inquiryType}\n会社名: ${companyName}\n担当者: ${contactName}\nメール: ${email}\n電話: ${form.get('phone') ?? ''}\n従業員数: ${form.get('employee_count') ?? ''}\n\n${rawMessage}`,
        }),
      });
    }
  } catch (e) {
    console.error('[contact] notify email failed:', e);
  }

  return {ok: true};
}

export default function ContactPage() {
  const {isDocument} = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const nav = useNavigation();
  const submitting = nav.state === 'submitting';
  const [done] = useState(false);

  if (actionData?.ok || done) {
    return (
      <div className="contact-page">
        <div className="contact-success">
          <h2>送信ありがとうございます</h2>
          <p>
            {isDocument
              ? '資料請求を受け付けました。担当者より2営業日以内に会社案内をお送りいたします。'
              : '導入のご相談を受け付けました。担当者より2営業日以内にご連絡いたします。'}
          </p>
          <p>
            お待ちいただかなくても、いますぐ資料をダウンロードいただけます。
          </p>
          <p>
            <a
              className="lp-btn lp-btn-gold"
              href="/japan-benefits-service-guide.pdf"
              download
            >
              資料をダウンロード（PDF）
            </a>
          </p>
          <p>
            <a href="/service-guide">ブラウザで見る →</a>
            　／　<Link to="/">トップへ戻る</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-page">
      <div className="page-heading">
        <h1>{isDocument ? '資料請求（無料）' : '導入のご相談'}</h1>
      </div>
      <p className="contact-intro">
        {isDocument ? (
          <>
            「JAPAN BENEFITS produced by BECOS」の会社案内・料金プランをPDFでお送りします。
            まだ検討段階の方も、まずは資料だけお気軽にお取り寄せください。
            ファウンディングメンバー（先行30社・初年度50%OFF）のご案内も同封いたします。
          </>
        ) : (
          <>
            「JAPAN BENEFITS produced by BECOS」は、日本全国の伝統工芸・日本製品を
            従業員とそのご家族に会員特別価格でお届けする法人向け福利厚生サービスです。
            導入のご相談・お見積り・ファウンディングメンバー（先行30社・初年度50%OFF）の
            お申し込みは、こちらのフォームよりお気軽にお問い合わせください。
          </>
        )}
      </p>

      <Form method="post" className="contact-form">
        <input
          type="hidden"
          name="inquiry_type"
          value={isDocument ? '資料請求' : '導入相談'}
        />
        {actionData?.error && (
          <div className="contact-error">{actionData.error}</div>
        )}
        <div className="form-group">
          <label htmlFor="company_name">貴社名</label>
          <input id="company_name" name="company_name" type="text" autoComplete="organization" />
        </div>
        <div className="form-group">
          <label htmlFor="contact_name">
            ご担当者名<span className="req">*</span>
          </label>
          <input id="contact_name" name="contact_name" type="text" required autoComplete="name" />
        </div>
        <div className="form-group">
          <label htmlFor="email">
            メールアドレス<span className="req">*</span>
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="form-group">
          <label htmlFor="phone">電話番号</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div className="form-group">
          <label htmlFor="employee_count">従業員数</label>
          <select id="employee_count" name="employee_count" defaultValue="">
            <option value="" disabled>選択してください</option>
            <option value="〜30名">〜30名</option>
            <option value="31〜100名">31〜100名</option>
            <option value="101〜300名">101〜300名</option>
            <option value="301名〜">301名〜</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="message">ご相談内容</label>
          <textarea id="message" name="message" placeholder="ご質問・ご要望などをご記入ください" />
        </div>
        <button type="submit" className="contact-submit" disabled={submitting}>
          {submitting ? '送信中…' : isDocument ? '資料を受け取る' : '送信する'}
        </button>
      </Form>
    </div>
  );
}
