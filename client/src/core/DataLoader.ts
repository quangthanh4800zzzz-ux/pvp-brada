import type { AttackDef, CharacterProfile, MapDefinition } from '@shared/types/index.js';
import type { AnimationManifest } from '../animation/manifest.js';

export const PRA_DATA_KEY = 'pra-data';

export interface LoadedData {
  characters: Record<string, CharacterProfile>;
  maps: Record<string, MapDefinition>;
  manifests: Record<string, AnimationManifest>;
}

/**
 * Loads all character profiles, maps, and animation manifests from the
 * data-driven content in /public/data and /public/assets.
 */
export async function loadGameData(): Promise<LoadedData> {
  const characters: Record<string, CharacterProfile> = {};
  const maps: Record<string, MapDefinition> = {};
  const manifests: Record<string, AnimationManifest> = {};
  for (const id of ['fighter_001']) {
    const res = await fetch(`data/characters/${id}.json`);
    if (!res.ok) throw new Error(`missing character ${id}`);
    characters[id] = (await res.json()) as CharacterProfile;
    const manifestRes = await fetch(`data/characters/${id}.manifest.json`);
    manifests[id] = (await manifestRes.json()) as AnimationManifest;
  }
  for (const id of MAP_IDS) {
    const res = await fetch(`data/maps/${id}.json`);
    if (!res.ok) throw new Error(`missing map ${id}`);
    maps[id] = (await res.json()) as MapDefinition;
  }
  validateProfiles(characters);
  return { characters, maps, manifests };
}

const MAP_IDS = ['map_01'];

export const mapList = (): string[] => [...MAP_IDS];

function validateProfiles(characters: Record<string, CharacterProfile>): void {
  for (const [id, profile] of Object.entries(characters)) {
    if (!profile.attacks || profile.attacks.length === 0) {
      throw new Error(`character ${id} has no attacks`);
    }
    const ids = new Set<string>();
    for (const attack of profile.attacks as AttackDef[]) {
      if (ids.has(attack.id)) throw new Error(`duplicate attack id ${attack.id} in ${id}`);
      ids.add(attack.id);
      if (attack.frames.startup < 0 || attack.frames.active <= 0 || attack.frames.recovery < 0) {
        throw new Error(`invalid frame data on ${attack.id} in ${id}`);
      }
      if (attack.hitboxWindows.length === 0) throw new Error(`attack ${attack.id} has no hitbox windows`);
    }
    if (!profile.passives.length) throw new Error(`character ${id} missing passive`);
  }
}
