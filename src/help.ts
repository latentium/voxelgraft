// VoxelGraft：help の文（UNIX の help の形。SKILL.md に差し込む：M4）
export const HELP = `NAME
    voxelgraft - AIと対話しながらボクセルアセットを生成するためのCLI（VoxelGraft）

SYNOPSIS
    voxelgraft check FILE
    voxelgraft build FILE [--out DIR]
    voxelgraft help

DESCRIPTION
    FILE は、アセットを書いた DSL（JSON）。節は asset、parts、assembly の三つ。
    結果は JSON で stdout に出す（help だけは、この文を出す）。

COMMANDS
    check FILE
        DSL を読み、形を検査する。ボクセルは作らない。
    build FILE [--out DIR]
        check に加えて、Part ごとに操作を当ててボクセルにし、assembly.inspect の検査をし、
        asset.parts の順に重ねて組み立て、assembly.export の形で書き出す。
        Part どうしで座標が重なったら、asset.parts で後の Part が上書きする。
        --out DIR   書き出す先（既定: ./out）
    help
        この説明を出す。

DSL
    {
      "asset": {
        "name": "chest",                    アセットの名（書き出すファイルの名にも使う）
        "size": [16, 12, 10],               大きさ [x, y, z]。1〜128。y が上
        "palette": { "wood": "#8b5a2b" },   材質名 → 色（#rrggbb）
        "parts": ["base", "lid"]            Part の名の並び（重ねる順）
      },
      "parts": {
        "base": [ 操作, ... ],              Part ごとの操作。上から順に当てる
        "lid":  [ 操作, ... ]
      },
      "assembly": {
        "inspect": ["bounds", "palette"],   検査
        "export": ["html"]                  書き出す形
      }
    }

OPERATIONS
    { "fill":   { "from": [x, y, z], "to": [x, y, z], "material": "wood" } }
        from と to を両端に含む箱を、その材質で埋める（すでにあれば上書き）
    { "remove": { "from": [x, y, z], "to": [x, y, z] } }
        from と to を両端に含む箱のボクセルを消す（1個なら from と to を同じにする）
    座標は 0〜127 の整数。

INSPECTIONS
    bounds    ボクセルが asset.size の内側にあるか
    palette   材質が asset.palette にあるか
    検査に落ちた Part は組み立てに使われない。結果の parts に problems と route が出る。

EXPORTS
    html      1 ファイルの HTML（DIR/asset.name.html）。人間が見るためのもの。
              斜め、正面・右・背面・左・上・下、六面の並び（3 × 2）を、ボタンで切り替える
              （正面は z の大きい側）
    vox       MagicaVoxel の .vox（DIR/asset.name.vox）。版 150、モデル一つ。
              .vox は z が上なので、軸を入れ替えて書く。材質は 255 種まで。材質名は残らない
    three     Three.js で .vox を表示する HTML（DIR/asset.name.three.html）。人間が見るためのもの。
              .vox を中に埋め込み、Three.js は CDN から読む（ネットへの接続が要る）。ドラッグで回す

RESULT
    {
      "command": "build",
      "file": "examples/chest.json",
      "status": "ok" | "dsl_error" | "inspect_failed" | "incomplete"
                | "export_failed" | "timeout" | "usage_error",
      "errors":  [ { "path": "parts.lid[1].fill.to", "message": "..." } ],
      "parts":   [ { "name": "lid", "status": "assembled" | "failed" | "held",
                     "voxels": 592, "problems": ["..."], "route": "..." } ],
      "asset":   { "name": "chest", "size": [16, 12, 10], "voxels": 1040 } | null,
      "outputs": ["out/chest.html"]
    }
    errors は DSL の誤り。path は DSL の中の場所。

EXIT STATUS
    0   成功
    1   DSL の誤り、検査に落ちた、組み立てられなかった、書き出しに失敗した、時間切れ
    2   使い方の誤り（知らないコマンドやオプション、FILE が無い、読めない）

EXAMPLES
    voxelgraft check examples/chest.json
    voxelgraft build examples/chest.json --out out
`;
