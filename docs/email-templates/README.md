# Supabase 認証メールテンプレート

このディレクトリは、Supabase（Authentication → Emails → Templates）に設定している
認証メールの**正本（canonical copy）**を保管する。

> ⚠️ Supabase のメールテンプレートはダッシュボード設定であり、Git からは自動デプロイされない。
> ここのファイルは記録・共有用。**変更時はダッシュボードとこのファイルの両方を更新すること。**

## なぜ token_hash 方式なのか（重要）

デフォルトの Supabase メールは `{{ .ConfirmationURL }}` を使い、リンクが
`https://<project-ref>.supabase.co/auth/v1/verify?...` という**ランダム文字列のドメイン**になる。

差出人ドメイン（`thebecos.com`）とリンクドメイン（`supabase.co`）が一致せず、
さらにリンク先がランダム英数字のため、**Gmail がフィッシング判定して赤い「危険」警告**を出した
（2026-06-11 実測）。

対策として、リンクを**サイト本体 `japan-benefits.jp` に向ける** token_hash 方式へ変更：

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<TYPE>
```

アプリ側 `app/routes/auth.confirm.tsx` の loader が `token_hash` + `type` を受け取り
`supabase.auth.verifyOtp()` で検証 → ログイン → `/auth/set-password` へ遷移する
（この処理は既に実装済み）。

この変更で赤警告が解消し、受信箱に届くことを確認済み（2026-06-11）。

## type の対応表

| テンプレート | ファイル | `type=` |
|------------|---------|---------|
| Invite user | `invite.html` | `invite` |
| Reset Password | `reset-password.html` | `recovery` |
| Magic Link | `magic-link.html` | `magiclink` |

## 差出人設定（Supabase → Authentication → Emails → SMTP Settings）

| 項目 | 値 |
|------|-----|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Sender email | `noreply-japan-benefits@thebecos.com` |
| Sender name | `JAPAN BENEFITS produced by BECOS` |

> 送信は Resend 経由。ドメイン `thebecos.com`（検証済み・SPF/DKIM/DMARC 全 PASS）を共用。
> 専用 API キー名: `japan-benefits-supabase`（Sending access）。

## 未対応テンプレート（低優先）

本サービスは招待制のため `Confirm signup` は通常使われない。
`Confirm signup` / `Change Email Address` は現状デフォルト（英語・supabase.co リンク）のまま。
これらを使う運用に変える場合は、同じ token_hash 方式へ差し替えること。
