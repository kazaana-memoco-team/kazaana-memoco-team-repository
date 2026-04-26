# チーム共通ルール

これらは**チーム全員に対する強制ルール**です。例外はありません。

## 必須 1: 作業前に最新の main を pull する

共同プロジェクトのため、いかなる作業を始める前にも、必ず GitHub から最新の状態を pull してください。

```bash
git pull origin main
```

### Why (pull)

- 共同編集中のコンフリクト・上書き事故を防ぐため
- 他メンバーの最新変更を踏まえた上で作業するため

### How to apply (pull)

- ファイル編集・コミット・ブランチ作成など、**あらゆる作業の開始前**に実行
- 長時間作業を中断していた場合、再開時にも必ず実行
- Claude Code に作業を依頼する場合も、依頼前に pull を行うこと

## 必須 2: main へは PR + auto-merge 経由でのみ反映する

main への直接 push は**禁止**です。すべての変更は feature branch を切り、Pull Request を作成してから auto-merge で main に統合します。

```bash
# 1. feature branch を切る
git checkout -b feature/<topic>

# 2. 変更をコミット
git add <files> && git commit -m "..."

# 3. push して PR を作成
git push -u origin feature/<topic>
gh pr create --base main --fill

# 4. auto-merge を有効化（チェック通過後に自動マージ）
gh pr merge --auto --squash
```

### Why (PR + auto-merge)

- main への直接 push をブロックすることで、レビュー機会と CI チェックを担保するため
- auto-merge により、レビュー・チェック通過後の手動マージ忘れを防ぐため
- 緊急時でもブランチ + PR の履歴が残ることでロールバックが容易になるため

### How to apply (PR + auto-merge)

- 些細な変更（ドキュメント修正・typo 修正など）でも例外なく PR 経由で行う
- PR タイトルは変更内容が一目で分かる簡潔なものにする
- `--squash` を基本とし、コミット履歴を main 上で綺麗に保つ
- Claude Code に作業を依頼する場合も、PR 作成・auto-merge 設定までを 1 セットとして実行する

## 必須 3: 短命ブランチ + 高頻度マージで main へどんどん統合する

複数人が並行作業するため、ブランチが長期化すると即座にコンフリクト地獄になります。**1 PR = 1 つの小さな変更**を原則に、可能な限り早く main へ統合してください。Trunk-Based Development を志向します。

### Why (rapid merge)

- 多人数が同時に main へ変更を入れる前提では、長命ブランチほど rebase コストが膨らむ
- 小さな PR ほどレビュー負荷が軽く、auto-merge が早く成立する
- 機能ごとに細切れに統合することで、問題発生時のロールバック粒度が細かくなる
- 「他の人が main を進めてくれているはず」を前提に協調できる文化を作る

### How to apply (rapid merge)

- ブランチは原則 **当日中（できれば数時間以内）にマージ** することを目標に切る
- 1 つの PR が 300 行を超えそうなら分割を検討する
- 作業中も `git pull --rebase origin main` で頻繁に main を取り込む（最低でも作業再開時は必須）
- 競合は早期発見・即解決。長く放置しない
- 大きな改修を始める前にチームへ一声かけ、並行作業の重複を避ける
- WIP でも構わないので、まず PR を draft で立てて作業の存在を可視化することを推奨

## 必須 4: 破壊的可能性のある CLI を既存リポで実行する前に保険を張る

`npm create *`, `*-init`, `*-create`, `yarn create *`, `bunx create-*`, `npx degit`, `cookiecutter` 等の **scaffold/initializer 系コマンド**は、内部で **`git init` を再実行したり既存ファイルを上書き・削除したり**する可能性があります。何の保険もなく既存リポで実行すると、`.git` 履歴の消失・既存ファイルの上書き・remote 設定の喪失といった事故が起こります（実際 2026-04 に Hydrogen scaffolder で発生済）。

### Why (scaffold safety)

- scaffolder は「空ディレクトリで動く」前提で書かれているものが多く、既存リポを尊重しない
- ローカルで履歴が飛んでも、リモートへ push 済みなら復旧できる（最後の防波堤）
- タグを打っておけば、scaffolder が orphan commit を作っても安全に拾い直せる

### How to apply (scaffold safety)

scaffold 系コマンドを既存リポで実行する場合、**必ず以下を事前に**:

```bash
# 1. すべての変更を origin に push 済みであることを確認
git status              # working tree clean
git push origin main    # ahead 0 / behind 0

# 2. 直前のコミットにバックアップタグを打つ（必要に応じて）
git tag pre-scaffold-$(date +%Y%m%d-%H%M%S)
git push origin --tags

# 3. 可能なら一度 別ディレクトリで scaffold して中身を確認、
#    問題なければ既存リポにコピーする方が安全
mkdir /tmp/scaffold-test && cd /tmp/scaffold-test
npm create <whatever>@latest -- --path .
# → 中身を確認 → 既存リポに rsync などで移植
```

scaffold が `.git` を吹き飛ばした場合の復旧:

```bash
git remote add origin <url>           # remote 再登録
git fetch origin                       # 元の履歴を取り戻す
git tag scaffold-snapshot HEAD         # 念のため scaffold を保全
git checkout -b feature/<name> origin/main  # 元 main から feature を切る
git checkout scaffold-snapshot -- .    # scaffold を上書きで合流
git add -A && git commit -m "..."
git branch -f main origin/main         # local main も巻き戻す
```

Claude Code に scaffold 系コマンドの実行を依頼する場合も、上記の保険手順をセットで実行してもらうこと。

## デプロイ

main にマージされた変更は Shopify が自動セットアップした GitHub Actions ワークフロー (`.github/workflows/oxygen-deployment-1000131506.yml`) によって **Shopify Oxygen** に自動デプロイされます。**追加の手動デプロイ作業は不要**です。

- 本番 URL（OAuth 保護下のステージング扱い、thebecos admin ログインで閲覧可）:
  <https://xn--becos-b0ec320ffe10bebbf598-yr75b2z1c5vr.o2.myshopify.dev/>
- デプロイトークンは GitHub Secrets `OXYGEN_DEPLOYMENT_TOKEN_1000131506`（Shopify Hydrogen channel が自動登録）
- Workflow の動作状況は [Actions タブ](../../actions) で確認できる
- 旧 GitHub Pages デプロイは廃止済み

### Vercel 連携について

リポに Vercel GitHub App が連携されているが、本プロジェクトは Hydrogen + Oxygen 専用のため、Vercel ビルドは [vercel.json](vercel.json) の `git.deploymentEnabled: false` で無効化している。Vercel チェックが PR で赤くなる場合は、この設定を確認すること。
