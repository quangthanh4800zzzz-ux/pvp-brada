export interface AnimationEventDef {
  frame: number;
  type:
    | 'activateHitbox'
    | 'deactivateHitbox'
    | 'playSound'
    | 'spawnParticle'
    | 'cameraShake'
    | 'screenFlash';
  params?: Record<string, unknown>;
}

export interface AnimationMeta {
  frameCount: number;
  fps: number;
  loop: boolean;
  frameWidth: number;
  frameHeight: number;
  file: string;
  events: AnimationEventDef[];
}

export interface EffectMeta {
  frameCount: number;
  fps: number;
  loop: boolean;
  file: string;
}

export interface AnimationManifest {
  format: number;
  frameWidth: number;
  frameHeight: number;
  hitboxes: Record<string, Record<string, { x: number; y: number; width: number; height: number }>>;
  animations: Record<string, AnimationMeta>;
  effects: Record<string, EffectMeta>;
}

/**
 * Validates an animation manifest against combat frame data.
 * Throws when animations are missing, thresholds are violated, or an attack
 * is not linked to an animation.
 */
export function validateManifest(
  manifest: AnimationManifest,
  attacks: { id: string; animation: string; frames: { startup: number; active: number; recovery: number } }[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const { animations } = manifest;
  for (const required of ['idle', 'walk', 'guard', 'hitReaction', 'victory', 'defeat']) {
    if (!animations[required]) errors.push({ code: 'missing-animation', detail: required });
  }
  for (const [name, meta] of Object.entries(animations)) {
    if (meta.frameCount < (meta.loop ? 4 : 6)) {
      errors.push({ code: 'too-few-frames', detail: `${name}:${meta.frameCount}` });
    }
  }
  for (const attack of attacks) {
    const meta = animations[attack.animation];
    if (!meta) {
      errors.push({ code: 'attack-without-animation', detail: attack.id });
      continue;
    }
    const total = attack.frames.startup + attack.frames.active + attack.frames.recovery;
    if (meta.frameCount < total) {
      errors.push({ code: 'animation-shorter-than-framedata', detail: `${attack.id} ${meta.frameCount}/${total}` });
    }
  }
  return errors;
}

export interface ValidationError {
  code: string;
  detail: string;
}
