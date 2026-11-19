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
}
