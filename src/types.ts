export type Vec3 = [number, number, number];
export interface Element {
  id: string;
  name: string;
  level: string;
  category: string;
  zone?: string;
  status?: string;
  note?: string;
  vertices: Vec3[];
  faces: number[][];
  material: string;
  face_materials?: string[];
  base_id?: string;
  evidence_refs?: string[];
  dimension_confidence?: string;
  finish_confidence?: string;
}
export interface MaterialSpec {
  color: number[];
  texture?: string;
  repeat_inches: number;
  roughness: number;
  metalness: number;
  opacity: number;
}
export interface SourceScene {
  name: string;
  mode: string;
  scope: string;
  perspective: boolean;
  lens: number;
  camera: { eye: Vec3; target: Vec3; height: number };
  visible_ids: string[];
}
export interface House {
  version: string;
  units: string;
  source_sha256: string;
  source_object_count: number;
  field_gate: string;
  derived: Record<string, number>;
  materials: Record<string, MaterialSpec>;
  elements: Element[];
  scenes: SourceScene[];
}
export interface View {
  id: string;
  title: string;
  subtitle: string;
  level: string;
  scene?: string;
  eye?: Vec3;
  target?: Vec3;
  note: string;
  interior?: boolean;
}
export type Layout = "both" | "ground" | "upper" | "assembled";
