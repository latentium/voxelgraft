# VoxelGraft

> 状態: 開発初期(M1〜M2 完了、M3 以降は未着手、M4 は暫定)。開発が落ち着くまでは、npmへの公開、公式マーケットプレイスへの申請は行いません。

AIと対話しながらボクセルアセットを生成するためのエージェント向けSkills。
Claude Codeでの使用に最適化。Command Code、Antigravity CLI、Piでも最低限の動作は確認。
ただし、Claude Code以外ではコマンドパスの自動探索処理が入るため、ややトークン消費が多くなる。


## コマンド実行

    bin/voxelgraft help
    bin/voxelgraft check examples/chest.json
    bin/voxelgraft build examples/chest.json --out out

> 現時点では Node v22 の `--experimental-transform-types` で、TypeScriptをそのまま動かす。

## Claude プラグインとしての試用

    claude --plugin-dir /path/to/voxelgraft

bin/ が PATH に入り、Skill から `voxelgraft` の名で実行可能となる。このオプション付きで起動する際の1回限りの読み込み。

Skill は依頼の内容(「voxelgraftでアセット制作」等、発動条件は厳しめ)から自動で呼ばれるほか、`/voxelgraft:voxelgraft` で手動実行も可

> Skillsとして有効化しなくても、SKILL.mdの内容と`voxelgraft help`の出力をAIエージェントに読ませれば使用可能とする設計方針。

## ライセンス

Apache License 2.0。詳細は [LICENSE](LICENSE) を参照。

# 以下は開発AIエージェント向け補足

## 型の検査

    npm install
    npm run typecheck

実行は型を検査しない（型を取り除くだけ）ので、型の誤りは typecheck で

## 今の範囲（M2）

- check、build、help
- 操作は fill と remove、検査は bounds と palette、書き出しは html、vox（MagicaVoxel の .vox）と three（Three.js による表示）
- Part どうしで座標が重なったら、asset.parts で後の Part が上書きする

## 仮のもの

- 結果の形（JSON）と、HTML の作り（1 ファイル、描く処理も自前）は仮。X3、X6 で比べる
- 管の時間切れは、事実上なくしている（X5 で扱う）

## 由来

- src/cell/ は、セルアーキテクチャ(本体は、まだ未公開)の試作コードから写した。
- 標識（M1、X1 等）の解説は [docs/labels.md](docs/labels.md)、依存関係を含むロードマップは [docs/roadmap.md](docs/roadmap.md) に記す。
