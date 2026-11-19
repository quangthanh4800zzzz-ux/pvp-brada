import { ACTIONS, type Action, type KeyBindings } from '@shared/types/input.js';

export interface GraphicsSettings {
  pixelScaling: 'nearest' | 'linear';
  showFps: boolean;
  screenShake: number;
  effectsQuality: 'low' | 'medium' | 'high';
  bloom: boolean;
  parallax: boolean;
  showHitboxes: boolean;
}

export interface AiSettings {
  difficulty: 'beginner' | 'easy' | 'normal' | 'hard' | 'expert';
}

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ui: number;
}

export interface InputSettings {
  p1: KeyBindings;
  p2: KeyBindings;
  inputBufferFrames: number;
  guardMode: 'hold' | 'toggle';
  doubleTapDash: boolean;
  gamepadDeadzone: number;
}

export interface SettingsData {
  version: number;
  graphics: GraphicsSettings;
  audio: AudioSettings;
  input: InputSettings;
  ai: AiSettings;
}

export const P1_DEFAULT: KeyBindings = {
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  up: 'KeyW',
  down: 'KeyS',
  jump: 'Space',
  dash: 'ShiftLeft',
  guard: 'KeyJ',
  light: 'KeyU',
  medium: 'KeyI',
  heavy: 'KeyO',
  skill1: 'Digit1',
  skill2: 'Digit2',
  skill3: 'Digit3',
  skill4: 'Digit4',
  ultimate: 'KeyH',
  interact: 'KeyE',
  pause: 'Escape',
  scoreboard: 'Tab',
  trainingReset: 'KeyR'
};

export const P2_DEFAULT: KeyBindings = {
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  jump: 'Numpad0',
  dash: 'ShiftRight',
  guard: 'Numpad1',
  light: 'Numpad4',
  medium: 'Numpad5',
  heavy: 'Numpad6',
  skill1: 'Numpad7',
  skill2: 'Numpad8',
  skill3: 'Numpad9',
  skill4: 'NumpadAdd',
  ultimate: 'NumpadEnter',
  interact: 'KeyL',
  pause: 'Escape',
  scoreboard: 'Tab',
  trainingReset: 'NumpadDecimal'
};

export const DEFAULT_SETTINGS: SettingsData = {
  version: 1,
  graphics: {
    pixelScaling: 'nearest',
    showFps: true,
    screenShake: 0.8,
    effectsQuality: 'high',
    bloom: true,
    parallax: true,
    showHitboxes: false
  },
  audio: { master: 0.8, music: 0.7, sfx: 0.9, ui: 0.8 },
  ai: { difficulty: 'normal' },
  input: {
    p1: { ...P1_DEFAULT },
    p2: { ...P2_DEFAULT },
    inputBufferFrames: 8,
    guardMode: 'hold',
    doubleTapDash: true,
    gamepadDeadzone: 0.2
  }
};

export interface KeyConflict {
  player: 'p1' | 'p2';
  key: string;
  actions: Action[];
}

export function detectConflicts(bindings: KeyBindings): KeyConflict[] {
  const byKey = new Map<string, Action[]>();
  for (const action of ACTIONS) {
    const key = bindings[action];
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(action);
    byKey.set(key, list);
  }
  const conflicts: KeyConflict[] = [];
  for (const [key, actions] of byKey) {
    if (actions.length > 1) conflicts.push({ player: 'p1', key, actions });
  }
  return conflicts;
}

export function isValidBinding(bindings: KeyBindings): boolean {
  for (const action of ACTIONS) {
    const key = bindings[action];
    if (typeof key !== 'string' || key.length === 0) return false;
  }
  return detectConflicts(bindings).length === 0;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const memoryStorage = (): StorageAdapter => {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k)
  };
};

const STORAGE_KEY = 'pra.settings.v1';

export class SettingsSystem {
  data: SettingsData = structuredClone(DEFAULT_SETTINGS);
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter | null = null) {
    this.storage =
      storage ??
      (typeof localStorage !== 'undefined'
        ? localStorage
        : memoryStorage());
    this.load();
  }

  load(): boolean {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as Partial<SettingsData>;
      this.data = this.validate(parsed);
      return true;
    } catch {
      this.data = structuredClone(DEFAULT_SETTINGS);
      return false;
    }
  }

  save(): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  validate(partial: Partial<SettingsData>): SettingsData {
    const result = structuredClone(DEFAULT_SETTINGS);
    if (partial.graphics) {
      Object.assign(result.graphics, partial.graphics);
      result.graphics.screenShake = Number(partial.graphics.screenShake ?? result.graphics.screenShake);
      if (!['nearest', 'linear'].includes(result.graphics.pixelScaling)) {
        result.graphics.pixelScaling = 'nearest';
      }
      if (result.graphics.screenShake < 0 || result.graphics.screenShake > 2 || Number.isNaN(result.graphics.screenShake)) {
        result.graphics.screenShake = DEFAULT_SETTINGS.graphics.screenShake;
      }
    }
    if (partial.audio) {
      for (const key of ['master', 'music', 'sfx', 'ui'] as const) {
        const value = Number(partial.audio[key]);
        result.audio[key] = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_SETTINGS.audio[key];
      }
    }
    if (partial.input) {
      if (partial.input.p1 && isValidBindingShape(partial.input.p1)) result.input.p1 = { ...partial.input.p1 };
      if (partial.input.p2 && isValidBindingShape(partial.input.p2)) result.input.p2 = { ...partial.input.p2 };
      const buffer = Number(partial.input.inputBufferFrames);
      if (Number.isFinite(buffer)) result.input.inputBufferFrames = Math.min(20, Math.max(0, Math.trunc(buffer)));
    }
    if (partial.ai) {
      if (!(['beginner', 'easy', 'normal', 'hard', 'expert'] as const).includes(partial.ai.difficulty)) {
        result.ai = structuredClone(DEFAULT_SETTINGS.ai);
      } else {
        result.ai = { difficulty: partial.ai.difficulty };
      }
    }
    return result;
  }

  rebind(player: 'p1' | 'p2', action: Action, key: string): KeyConflict[] {
    const bindings = this.data.input[player];
    bindings[action] = key;
    return detectConflicts(bindings);
  }

  resetSection(section: 'graphics' | 'audio' | 'input' | 'ai'): void {
    const defaults = structuredClone(DEFAULT_SETTINGS[section]) as (typeof this.data)['graphics'];
    (this.data[section] as GraphicsSettings | AudioSettings | InputSettings | AiSettings) = defaults;
    this.save();
  }

  export(): string {
    return JSON.stringify(this.data, null, 2);
  }

  import(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as Partial<SettingsData>;
      if (typeof parsed !== 'object' || parsed === null) return false;
      this.data = this.validate(parsed);
      this.save();
      return true;
    } catch {
      return false;
    }
  }
}

function isValidBindingShape(bindings: Partial<KeyBindings>): bindings is KeyBindings {
  return ACTIONS.every((action) => typeof bindings[action] === 'string' && (bindings[action] as string).length > 0);
}
