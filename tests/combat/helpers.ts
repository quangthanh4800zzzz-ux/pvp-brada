import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CharacterProfile, MapDefinition } from '@shared/types/index.js';

const root = resolve(process.cwd(), 'client/public/data');

export function loadStandins(): { map: MapDefinition; profileA: CharacterProfile; profileB: CharacterProfile } {
  const map = JSON.parse(readFileSync(resolve(root, 'maps/map_01.json'), 'utf-8')) as MapDefinition;
  const profileA = JSON.parse(readFileSync(resolve(root, 'characters/fighter_001.json'), 'utf-8')) as CharacterProfile;
  const profileB = JSON.parse(readFileSync(resolve(root, 'characters/fighter_001.json'), 'utf-8')) as CharacterProfile;
  return { map, profileA, profileB };
}
