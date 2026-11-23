# VoxelGraft

AIと対話しながらボクセルアセットを生成するためのエージェント向けSkills。

標識（M1、X1 等）の解説は [docs/labels.md](docs/labels.md)、依存関係を含むロードマップは [docs/roadmap.md](docs/roadmap.md) に記す。

## 実行の仕方

    bin/voxelgraft help
    bin/voxelgraft check examples/chest.json
    bin/voxelgraft build examples/chest.json --out out

Node v22 の `--experimental-transform-types` で、TypeScript をそのまま動かす。

## プラグインとしての試用

    claude --plugin-dir /path/to/voxelgraft

bin/ が PATH に載り、Skill から `voxelgraft` の名で呼べる。オプション付きで起動する際の1回限りの読み込み

Skill は依頼の内容から自動で呼ばれるほか、`/voxelgraft:voxelgraft` で手動でも呼べる。

## 型の検査

    npm install
    npm run typecheck

実行は型を検査しない（型を取り除くだけ）ので、型の誤りは typecheck で見つける。

## 今の範囲（M2）

- check、build、help
- 操作は fill と remove、検査は bounds と palette、書き出しは html、vox（MagicaVoxel の .vox）と three（Three.js による表示）
- Part どうしで座標が重なったら、asset.parts で後の Part が上書きする

## 仮のもの

- 結果の形（JSON）と、HTML の作り（1 ファイル、描く処理も自前）は仮。X3、X6 で比べる
- 管の時間切れは、事実上なくしている（X5 で扱う）

## 由来

src/cell/ は、セルアーキテクチャの試作コードから写した。
