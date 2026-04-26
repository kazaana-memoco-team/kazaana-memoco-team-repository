# Design Specs

Google Labs `design.md` の公式サンプル一式。AI コーディングツール（Cursor, Claude Code 等）に読み込ませて、デザイン一貫性を保ったまま実装する用途を想定しています。

## 収録サンプル

- [atmospheric-glass](./atmospheric-glass/) — 透明感のあるガラスモチーフ
- [paws-and-paths](./paws-and-paths/) — ペット系
- [totality-festival](./totality-festival/) — フェス系

各サンプルには次の 4 ファイルが含まれます。

| ファイル | 役割 |
| --- | --- |
| `DESIGN.md` | デザイン仕様本体（YAML フロントマター + 説明文） |
| `README.md` | サンプルプロジェクトの概要 |
| `design_tokens.json` | DTCG 形式のトークン |
| `tailwind.config.js` | Tailwind CSS 設定例 |

## 使い方の例

Cursor / Claude Code に「`design/atmospheric-glass/DESIGN.md` を参照して、このトークンに従って `<Button>` を実装して」と依頼するだけで、デザイン意図に沿った実装が得られます。

公開 URL からも参照可能（例: `https://kazaana-memoco-team.github.io/kazaana-memoco-team-repository/design/atmospheric-glass/DESIGN.md`）。

## 出典

- 公式仕様: <https://github.com/google-labs-code/design.md>
- 解説（gihyo.jp）: <https://gihyo.jp/article/2026/04/stitch-design-md-open-source>
- 解説（note）: <https://note.com/howmanydesigns/n/nae3dfff16e30>
