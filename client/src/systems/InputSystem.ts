import { ACTIONS, emptyIntent, type Action, type Intent, type KeyBindings } from '@shared/types/input.js';

export interface KeySnapshot {
  down: Set<string>;
  consumePressed: Set<string>;
}

export interface InputSource {
  snapshot(): KeySnapshot;
}

export class KeyboardSource implements InputSource {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private attached = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
    if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  private onBlur = (): void => {
    this.down.clear();
  };

  attach(target: Window): void {
    if (this.attached) return;
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
    this.attached = true;
  }

  detach(target: Window): void {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
    target.removeEventListener('blur', this.onBlur);
    this.attached = false;
  }

  snapshot(): KeySnapshot {
    const pressed = new Set(this.pressed);
    this.pressed.clear();
    return { down: new Set(this.down), consumePressed: pressed };
  }

}

export class ManualKeySource implements InputSource {
  private down = new Set<string>();
  private pressed = new Set<string>();

  press(code: string): void {
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
  }

  release(code: string): void {
    this.down.delete(code);
  }

  clear(): void {
    this.down.clear();
  }

  snapshot(): KeySnapshot {
    const pressed = new Set(this.pressed);
    this.pressed.clear();
    return { down: new Set(this.down), consumePressed: pressed };
  }
}

export const BLOCK_DEFAULT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab']);

export interface BufferedInput {
  action: Action;
  ttl: number;
}

export class InputSystem {
  buffer: BufferedInput[] = [];
  bufferFrames = 8;

  poll(bindings: KeyBindings, snapshot: KeySnapshot): Intent {
    const intent = emptyIntent();
    const lookup = (action: Action): boolean => {
      const code = bindings[action];
      return code !== undefined && snapshot.consumePressed.has(code);
    };
    const held = (action: Action): boolean => {
      const code = bindings[action];
      return code !== undefined && snapshot.down.has(code);
    };

    const left = held('moveLeft');
    const right = held('moveRight');
    intent.moveX = left && !right ? -1 : right && !left ? 1 : 0;
    intent.down = held('down');
    intent.jumpPressed = lookup('jump');
    intent.jumpHeld = held('jump');
    intent.dashPressed = lookup('dash');
    intent.guardHeld = held('guard');
    intent.guardPressed = lookup('guard');
    if (lookup('light')) intent.attackPressed = 'light';
    else if (lookup('medium')) intent.attackPressed = 'medium';
    else if (lookup('heavy')) intent.attackPressed = 'heavy';
    if (lookup('skill1')) intent.skillPressed = 1;
    else if (lookup('skill2')) intent.skillPressed = 2;
    else if (lookup('skill3')) intent.skillPressed = 3;
    else if (lookup('skill4')) intent.skillPressed = 4;
    intent.ultimatePressed = lookup('ultimate');
    intent.interactPressed = lookup('interact');
    intent.dropThroughPressed = held('down') && lookup('jump');

    for (const key of snapshot.consumePressed) {
      if (key === bindings.pause) this.buffer.push({ action: 'pause', ttl: this.bufferFrames });
      if (key === bindings.trainingReset) this.buffer.push({ action: 'trainingReset', ttl: this.bufferFrames });
    }

    if (intent.attackPressed) {
      this.push({ action: intent.attackPressed, ttl: this.bufferFrames });
    }
    return intent;
  }

  push(entry: { action: Action; ttl: number }): void {
    this.buffer.push(entry);
  }

  tickBuffer(): void {
    for (const entry of this.buffer) entry.ttl--;
    this.buffer = this.buffer.filter((entry) => entry.ttl > 0);
  }

  consume(action: Action): boolean {
    const index = this.buffer.findIndex((entry) => entry.action === action);
    if (index >= 0) {
      this.buffer.splice(index, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    this.buffer = [];
  }
}

export function makeIntent(overrides: Partial<Intent>): Intent {
  return { ...emptyIntent(), ...overrides };
}
