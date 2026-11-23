// VoxelGraft：vesicle の cargo の形（Part、設計図、組み立てたアセット）と、シグネチャー
import type { Vesicle } from "./cell/core.ts";
import type { Op, Vec3 } from "./dsl.ts";
import type { VoxelMap } from "./voxels.ts";

export const SIG_ROOT = "sig-voxelgraft";
export const SIG_PART = "sig-part"; // Part と設計図
export const SIG_ASSEMBLY = "sig-assembly";
export const SIG_ASSET = "sig-asset"; // 組み立てたアセット

export interface PartCargo {
  kind: "part";
  name: string;
  ops: Op[];
  voxels?: VoxelMap; // 段 build の後に入る
}

export interface BlueprintCargo {
  kind: "blueprint";
  name: string;
  size: Vec3;
  needs: string[]; // Part の名の並び（重ねる順）
}

export interface AssetCargo {
  kind: "asset";
  name: string;
  size: Vec3;
  voxels: VoxelMap;
  partVoxels: Record<string, number>; // Part ごとのボクセルの数（重ねる前）
}

export type Cargo = PartCargo | BlueprintCargo | AssetCargo;

export const cargoOf = (v: Vesicle): Cargo => v.envelope.cargo as Cargo;
