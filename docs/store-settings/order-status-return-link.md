# サンクスページに「JAPAN BENEFITS に戻る」導線を追加（#8）

## 背景
福利厚生サイトの決済は BECOS（thebecos）の Draft Order 決済を通るため、決済完了後の
サンクスページ（注文ステータスページ）は **BECOS ドメイン**で表示され、
そのままでは japan-benefits.jp に戻れず動線が途切れる。

## 対応方針
サンクスページに戻るリンクを出すが、**BECOS本体の通常客には出さない**よう、
注文タグ `福利厚生サイト` が付いた注文のときだけ表示する。

これは Hydrogen アプリのコードではなく、**BECOS-JP（thebecos）Shopify管理画面の設定**で行う。

## 手順（BECOS-JP管理画面）
1. **設定 → チェックアウト → 注文ステータスページ → 追加スクリプト**
   （Settings → Checkout → Order status page → Additional scripts）
2. 以下を貼り付けて保存：

```liquid
{% if order.tags contains '福利厚生サイト' %}
  <div style="text-align:center;margin:24px 0;">
    <a href="https://japan-benefits.jp/"
       style="display:inline-block;background:#99201c;color:#fff;
              padding:12px 28px;border-radius:6px;text-decoration:none;
              font-weight:bold;font-family:sans-serif;">
      JAPAN BENEFITS に戻る
    </a>
  </div>
{% endif %}
```

## 注意・確認事項
- 「追加スクリプト」は注文ステータスページ用。`order.tags` で出し分けできる。
- 新しいチェックアウト（checkout extensibility）へ移行している場合は、追加スクリプトが
  使えないことがある。その場合は checkout UI extension（thank-you ブロック）での実装に切替。
- 本体の通常注文には出ないこと（タグ条件）を、福利厚生の注文・通常注文の両方で目視確認すること。
