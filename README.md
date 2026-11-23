# VoxelGraft

対話でボクセルアセットを育てるための CLI。Claude Code の Skills から使うことを想定している（Skills は M4 で用意する）。

## 実行の仕方

    bin/voxelgraft help
    bin/voxelgraft check examples/chest.json
    bin/voxelgraft build examples/chest.json --out out

Node v22 の `--experimental-transform-types` で、TypeScript をそのまま動かす。

## 今の範囲（M2）

- check、build、help
- 操作は fill と remove、検査は bounds と palette、書き出しは html
- Part どうしで座標が重なったら、asset.parts で後の Part が上書きする

## 仮のもの

- 結果の形（JSON）と、HTML の作り（1 ファイル、描く処理も自前）は仮。X3、X6 で比べる
- 管の時間切れは、事実上なくしている（X5 で扱う）
- 型の検査（tsc）は、まだ入れていない

## 由来

src/cell/ は、セルアーキテクチャの試作コードから写した。
