import type { CharacterProfile, MapDefinition, SkillDef } from '@shared/types/index.js';
import { validateManifest } from '../animation/manifest.js';
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
  for (const id of ROSTER_IDS) {
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

export function validateData(data: LoadedData): string[] {
  return Object.entries(data.manifests).flatMap(([charId, manifest]) => {
    const profile = data.characters[charId];
    const attacks = profile ? [...profile.attacks, ...(profile.skills ?? [])] : [];
    return validateManifest(manifest, attacks).map((err) => `${charId}:${err.code}:${err.detail}`);
  });
}

let bootData: LoadedData | null = null;

export function setBootData(data: LoadedData): void {
  bootData = data;
}

export function getBootData(): LoadedData {
  if (!bootData) throw new Error('boot data not prepared');
  return bootData;
}

const ROSTER_IDS = ['fighter_001', 'fighter_002'];

const MAP_IDS = ['map_01'];

export const mapList = (): string[] => [...MAP_IDS];

function validateProfiles(characters: Record<string, CharacterProfile>): void {
  for (const [id, profile] of Object.entries(characters)) {
    if (!profile.attacks || profile.attacks.length === 0) {
      throw new Error(`character ${id} has no attacks`);
    }
    const ids = new Set<string>();
    for (const attack of profile.attacks) {
      if (ids.has(attack.id)) throw new Error(`duplicate attack id ${attack.id} in ${id}`);
      ids.add(attack.id);
      if (attack.frames.startup < 0 || attack.frames.active <= 0 || attack.frames.recovery < 0) {
        throw new Error(`invalid frame data on ${attack.id} in ${id}`);
      }
      if (attack.hitboxWindows.length === 0) throw new Error(`attack ${attack.id} has no hitbox windows`);
    }
    const slots = new Set<number>();
    for (const skill of (profile.skills ?? []) as SkillDef[]) {
      if (ids.has(skill.id)) throw new Error(`duplicate skill id ${skill.id} in ${id}`);
      ids.add(skill.id);
      if (slots.has(skill.slot)) throw new Error(`duplicate skill slot ${skill.slot} in ${id}`);
      slots.add(skill.slot);
      if (skill.frames.startup < 0 || skill.frames.active <= 0 || skill.frames.recovery < 0) {
        throw new Error(`invalid frame data on skill ${skill.id} in ${id}`);
      }
      const needsHitbox = skill.skillKind === 'meleeStrike';
      if (needsHitbox && skill.hitboxWindows.length === 0) {
        throw new Error(`melee skill ${skill.id} in ${id} has no hitbox windows`);
      }
      if (skill.skillKind === 'projectile' && !skill.projectile) {
        throw new Error(`projectile skill ${skill.id} in ${id} missing projectile def`);
      }
      if (skill.skillKind === 'buff' && !skill.buff) {
        throw new Error(`buff skill ${skill.id} in ${id} missing buff def`);
      }
    }
    if (!profile.passives.length) throw new Error(`character ${id} missing passive`);
  }
}
