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
