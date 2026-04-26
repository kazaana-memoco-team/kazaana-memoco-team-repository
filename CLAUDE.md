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

## デプロイ

main にマージされた変更は GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) によって自動的に GitHub Pages へデプロイされます。**追加の手動デプロイ作業は不要**です。

- デプロイ URL: GitHub の `Settings → Pages` で確認
- main へのマージ = 即本番反映 という前提のため、PR レビュー時はその意識を持つこと
- Workflow の動作状況は [Actions タブ](../../actions) で確認できる
