export interface MapModifierZone {
  id: string;
  region: { x: number; y: number; width: number; height: number };
  gravityMultiplier?: number;
  frictionMultiplier?: number;
  movementMultiplier?: number;
  horizontalForce?: number;
  verticalForce?: number;
  damageMultiplier?: number;
  flags?: string[];
}

export interface MapSolid {
  x: number;
  y: number;
  width: number;
  height: number;
  oneWay?: boolean;
  visual: 'ground' | 'platform' | 'crate';
}

export interface MapMoverDef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  axis: 'x' | 'y';
  distance: number;
  periodMs: number;
  phase: number;
}

export interface SkylineLayer {
  scrollFactor: number;
  color: number;
  count: number;
  heightMin: number;
  heightMax: number;
  windows: { color: number; litChance: number };
}

export interface NeonSign {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  blinkMs?: number;
}

export interface MapVisuals {
  skyline?: SkylineLayer[];
  neonSigns?: NeonSign[];
  rain?: { enabled: boolean; density?: number; scrollFactor?: number };
  vignette?: boolean;
}

export interface MapDefinition {
  id: string;
  name: string;
  theme: string;
  bounds: { width: number; height: number };
  spawn1: { x: number; y: number };
  spawn2: { x: number; y: number };
  solids: MapSolid[];
  movers: MapMoverDef[];
  zones: MapModifierZone[];
  sky: [number, number, number][];
  parallaxSeed: number;
  visuals?: MapVisuals;
}
