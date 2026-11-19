import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePNG } from './png.mjs';

const OUT_ROOT = new URL('../public/assets/', import.meta.url).pathname;
const FW = 48;
const FH = 48;

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255];

class Canvas {
  constructor(w = FW, h = FH) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }
  px(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = hex(color);
    this.data.set([r, g, b, a], (y * this.w + x) * 4);
  }
  rect(x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, color);
  }
  limb(x0, y0, x1, y1, thickness, color, shade = 0x00000000) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      const half = Math.floor(thickness / 2);
      for (let oy = -half; oy <= half; oy++) {
        for (let ox = -half; ox <= half; ox++) {
          if (shade !== 0x00000000 && (ox === -half || oy === -half)) this.px(cx + ox, cy + oy, shade);
          else this.px(cx + ox, cy + oy, color);
        }
      }
    }
  }
}

const PAL = {
  outline: 0x101418,
  skin: 0xd9a066,
  skinShade: 0xa8704a,
  hair: 0x241f31,
  cloth: 0x89312d,
  clothShade: 0x5c1f1c,
  clothLight: 0xc2504a,
  pants: 0x3d3a4a,
  pantsShade: 0x292635,
  boots: 0x4a4238,
  eye: 0x9de1ff,
  metal: 0x8a8fa3,
  aura: 0xffb84a,
  auraCore: 0xfff0a0,
  spark: 0xfff4c2,
  sparkEdge: 0xff9d2e,
  dust: 0xb0a48c,
  slash: 0xd6f3ff
};

function head(c, x, y, lean = 0) {
  c.rect(x + Math.round(lean * 0.4), y, 9, 8, PAL.skin);
  c.rect(x + Math.round(lean * 0.4), y, 9, 2, PAL.hair);
  c.rect(x + Math.round(lean * 0.4), y + 1, 9, 1, PAL.hair);
  c.px(x + Math.round(lean * 0.4) + 6, y + 4, PAL.eye);
  c.px(x + Math.round(lean * 0.4) + 7, y + 4, PAL.eye);
  c.px(x + Math.round(lean * 0.4) - 1, y + 2, PAL.outline);
}

/**
 * Draws the humanoid. Foot/hand positions are absolute in frame space.
 * Anchor: hip center at (24 - lean, 36 - crouch*4).
 */
function drawFighter(c, pose) {
  const hipX = 24 + (pose.lean ?? 0);
  const hipY = 37 - (pose.crouch ?? 0) * 5;
  const neckX = hipX + Math.round((pose.lean ?? 0) * 0.6);
  const neckY = hipY - 13;
  const shoulderY = neckY + 2;

  c.limb(hipX - 2, hipY, pose.footBack.x, pose.footBack.y, 3, PAL.pantsShade, PAL.outline);
  c.limb(hipX + 2, hipY, pose.footFront.x, pose.footFront.y, 3, PAL.pants, PAL.outline);
  c.rect(pose.footFront.x - 2, Math.min(pose.footFront.y, FH - 3), 6, 2, PAL.boots);
  c.rect(pose.footBack.x - 2, Math.min(pose.footBack.y, FH - 3), 5, 2, PAL.pantsShade);

  c.limb(hipX, hipY - 2, neckX, shoulderY + 4, 5, PAL.clothShade, PAL.outline);

  if (pose.aura) {
    const r = pose.aura;
    for (let i = 0; i < 26; i++) {
      const a = pose.auraPhase ?? 0;
      const ang = (i / 26) * Math.PI * 2 + a;
      const rr = 13 + Math.sin(i * 2.7 + a * 3) * 2;
      c.px(hipX + Math.cos(ang) * rr, hipY - 6 + Math.sin(ang) * rr, i % 3 === 0 ? PAL.auraCore : PAL.aura);
    }
  }

  head(c, neckX - 3, neckY - 8, (pose.lean ?? 0) + (pose.headLean ?? 0));

  c.limb(neckX, shoulderY, pose.handBack.x, pose.handBack.y, 3, PAL.clothShade, PAL.outline);
  c.limb(neckX, shoulderY, pose.handFront.x, pose.handFront.y, 3, PAL.cloth, PAL.outline);
  c.px(pose.handFront.x, pose.handFront.y, PAL.skin);
  c.px(pose.handBack.x, pose.handBack.y, PAL.skinShade);

  if (pose.smear) {
    for (let i = 0; i < 5; i++) {
      c.px(pose.handFront.x - i * (pose.smearDir ?? 2), pose.handFront.y + (i % 2), PAL.slash);
    }
  }
  if (pose.glow) {
    const hx = pose.handFront.x;
    const hy = pose.handFront.y;
    c.rect(hx - 1, hy - 1, 3, 3, PAL.auraCore);
    c.px(hx - 3, hy, PAL.aura);
    c.px(hx + 3, hy, PAL.aura);
    c.px(hx, hy - 3, PAL.aura);
    c.px(hx, hy + 3, PAL.aura);
  }
}

const stand = (over = {}) => ({
  footFront: { x: 28, y: 45 },
  footBack: { x: 20, y: 45 },
  handFront: { x: 29, y: 30 },
  handBack: { x: 18, y: 31 },
  lean: 0,
  crouch: 0,
  ...over
});

const lerpPose = (a, b, t) => {
  const out = { ...a, footFront: {}, footBack: {}, handFront: {}, handBack: {} };
  for (const part of ['footFront', 'footBack', 'handFront', 'handBack']) {
    for (const axis of ['x', 'y']) {
      out[part][axis] = a[part][axis] + (b[part][axis] - a[part][axis]) * t;
    }
  }
  for (const key of ['lean', 'crouch', 'headLean']) {
    out[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * t;
  }
  return out;
};

function swingPose(p, hand, angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    ...p,
    [hand]: { x: 24 + Math.cos(rad) * radius, y: 31 + Math.sin(rad) * radius * 0.7 }
  };
}

const POSE_WINDUP = stand({ handFront: { x: 15, y: 27 }, handBack: { x: 17, y: 33 }, lean: -1, crouch: 0.2 });
const POSE_EXTEND = stand({ handFront: { x: 40, y: 28 }, handBack: { x: 14, y: 32 }, lean: 3, crouch: 0.1 });
const POSE_HOOKWIND = stand({ handFront: { x: 13, y: 33 }, handBack: { x: 16, y: 27 }, lean: -2, crouch: 0.4 });
const POSE_HOOKHIT = stand({ handFront: { x: 39, y: 20 }, handBack: { x: 15, y: 34 }, lean: 3, crouch: 0 });
const POSE_UPPERWIND = stand({ handFront: { x: 19, y: 38 }, handBack: { x: 15, y: 30 }, lean: -1, crouch: 0.9 });
const POSE_UPPERHIT = stand({ handFront: { x: 32, y: 12 }, handBack: { x: 14, y: 33 }, lean: 2, crouch: -0.4 });
const POSE_GUARD = stand({ handFront: { x: 31, y: 26 }, handBack: { x: 27, y: 29 }, lean: -1, crouch: 0.3 });
const POSE_AIRKICK = { footFront: { x: 36, y: 36 }, footBack: { x: 16, y: 40 }, handFront: { x: 33, y: 22 }, handBack: { x: 15, y: 24 }, lean: 2, crouch: 0 };
const POSE_HIT = stand({ handFront: { x: 33, y: 35 }, handBack: { x: 36, y: 27 }, lean: -3, headLean: -1, crouch: 0.1 });
const POSE_VICTORY = stand({ handFront: { x: 27, y: 12 }, handBack: { x: 17, y: 32 }, lean: 0 });
const POSE_DEFECT = stand({ handFront: { x: 22, y: 40 }, handBack: { x: 17, y: 41 }, lean: -2, crouch: 1 });

function animationFrames({ length, poseAt, fps, loop }) {
  const frames = [];
  for (let i = 0; i < length; i++) {
    const canvas = new Canvas();
    const pose = poseAt(i, length);
    drawFighter(canvas, pose);
    frames.push(canvas);
  }
  return { frames, fps, loop };
}

const ANIMATIONS = {
  idle: animationFrames({
    length: 14,
    fps: 12,
    loop: true,
    poseAt: (i) => {
      const br = Math.sin((i / 14) * Math.PI * 2);
      return stand({
        lean: Math.sin((i / 14) * Math.PI * 4) * 0.6,
        crouch: 0.15 + br * 0.1,
        handFront: { x: 29, y: 30 + br },
        handBack: { x: 18, y: 31 - br }
      });
    }
  }),
  walk: animationFrames({
    length: 14,
    fps: 16,
    loop: true,
    poseAt: (i) => {
      const ph = (i / 14) * Math.PI * 2;
      return stand({
        footFront: { x: 24 + Math.cos(ph) * 6, y: 45 - Math.max(0, Math.sin(ph)) * 3 },
        footBack: { x: 24 - Math.cos(ph) * 6, y: 45 - Math.max(0, -Math.sin(ph)) * 3 },
        handFront: { x: 24 + Math.cos(ph + Math.PI) * 4, y: 30 },
        handBack: { x: 24 - Math.cos(ph + Math.PI) * 4, y: 30 }
      });
    }
  }),
  run: animationFrames({
    length: 12,
    fps: 18,
    loop: true,
    poseAt: (i) => {
      const ph = (i / 12) * Math.PI * 2;
      return stand({
        lean: 2,
        crouch: 0.25,
        footFront: { x: 24 + Math.cos(ph) * 8, y: 44 - Math.max(0, Math.sin(ph)) * 5 },
        footBack: { x: 24 - Math.cos(ph) * 8, y: 44 - Math.max(0, -Math.sin(ph)) * 5 },
        handFront: { x: 24 + Math.cos(ph + Math.PI) * 6, y: 29 },
        handBack: { x: 24 - Math.cos(ph + Math.PI) * 6, y: 29 }
      });
    }
  }),
  jump: animationFrames({
    length: 8,
    fps: 14,
    loop: false,
    poseAt: (i, n) => {
      const t = i / (n - 1);
      return stand({
        footFront: { x: 27 + t * 4, y: 42 - t * 8 },
        footBack: { x: 20 - t * 2, y: 41 - t * 6 },
        handFront: { x: 27 + t * 5, y: 18 + t * 4 },
        handBack: { x: 20 - t * 3, y: 26 },
        crouch: 0.4 * (1 - t * 2) + (t > 0.5 ? 0.2 : 0),
        lean: 1
      });
    }
  }),
  fall: animationFrames({
    length: 8,
    fps: 14,
    loop: true,
    poseAt: (i, n) => {
      const t = i / (n - 1);
      return stand({
        footFront: { x: 29, y: 40 + t * 2 },
        footBack: { x: 18, y: 39 },
        handFront: { x: 32, y: 20 },
        handBack: { x: 15, y: 22 },
        lean: -1,
        crouch: -0.2
      });
    }
  }),
  dash: animationFrames({
    length: 8,
    fps: 20,
    loop: false,
    poseAt: (i, n) => {
      const t = i / (n - 1);
      return stand({
        lean: 4,
        crouch: 0.5,
        footFront: { x: 33 - t * 4, y: 44 },
        footBack: { x: 13, y: 45 },
        handFront: { x: 26, y: 30 },
        handBack: { x: 34 - t * 3, y: 32 },
        smear: true,
        smearDir: -2
      });
    }
  }),
  light: animationFrames({
    length: 15,
    fps: 60,
    loop: false,
    poseAt: (i, n) => {
      const t = i / (n - 1);
      if (i < 4) return lerpPose(stand(), POSE_WINDUP, (i + 1) / 4);
      if (i < 7) return lerpPose(POSE_WINDUP, POSE_EXTEND, (i - 3) / 3);
      if (i < 9) return { ...POSE_EXTEND, smear: true, glow: i === 6 || i === 7 };
      return lerpPose(POSE_EXTEND, stand(), (i - 6) / (n - 7));
    }
  }),
  medium: animationFrames({
    length: 27,
    fps: 60,
    loop: false,
    poseAt: (i, n) => {
      if (i < 8) return lerpPose(stand(), POSE_HOOKWIND, (i + 1) / 8);
      if (i < 13) return lerpPose(POSE_HOOKWIND, POSE_HOOKHIT, (i - 7) / 5);
      if (i < 15) return { ...POSE_HOOKHIT, glow: true };
      return lerpPose(POSE_HOOKHIT, stand(), (i - 12) / (n - 13));
    }
  }),
  heavy: animationFrames({
    length: 44,
    fps: 60,
    loop: false,
    poseAt: (i, n) => {
      if (i < 15) return lerpPose(stand(), POSE_UPPERWIND, (i + 1) / 15);
      if (i < 21) return lerpPose(POSE_UPPERWIND, POSE_UPPERHIT, (i - 14) / 6);
      if (i < 23) return { ...POSE_UPPERHIT, glow: true, aura: true, auraPhase: i };
      return lerpPose(POSE_UPPERHIT, stand(), (i - 20) / (n - 21));
    }
  }),
  airAttack: animationFrames({
    length: 21,
    fps: 60,
    loop: false,
    poseAt: (i) => {
      if (i < 5) return { ...POSE_AIRKICK };
      if (i < 9) return swingPose(POSE_AIRKICK, 'handFront', 150 - (i - 5) * 10, 15 + (i - 5));
      if (i < 11) return { ...swingPose(POSE_AIRKICK, 'handFront', 118, 18), smear: true, glow: true };
      return { ...POSE_AIRKICK };
    }
  }),
  dashAttack: animationFrames({
    length: 27,
    fps: 60,
    loop: false,
    poseAt: (i, n) => {
      if (i < 6) {
        const t = i / 6;
        return stand({ lean: 4, crouch: 0.5, footFront: { x: 33 - t * 4, y: 44 }, footBack: { x: 13, y: 45 }, handFront: { x: 24, y: 32 }, handBack: { x: 34 - t * 4, y: 32 }, smear: true, smearDir: -2 });
      }
      if (i < 11) return lerpPose(stand({ footFront: { x: 33, y: 44 }, footBack: { x: 13, y: 45 } }), POSE_EXTEND, (i - 5) / 5);
      if (i < 13) return { ...POSE_EXTEND, smear: true, glow: true };
      return lerpPose(POSE_EXTEND, stand({ footFront: { x: 30, y: 45 } }), (i - 10) / (n - 11));
    }
  }),
  guard: animationFrames({
    length: 6,
    fps: 12,
    loop: true,
    poseAt: (i) => {
      const br = Math.sin((i / 6) * Math.PI * 2) * 0.5;
      return { ...POSE_GUARD, crouch: 0.3 + br * 0.1, lean: -1 };
    }
  }),
  hitReaction: animationFrames({
    length: 10,
    fps: 20,
    loop: false,
    poseAt: (i) => {
      const t = i / 9;
      const p = lerpPose(stand(), POSE_HIT, Math.min(1, t * 3));
      return p;
    }
  }),
  knockdown: animationFrames({
    length: 8,
    fps: 12,
    loop: false,
    poseAt: (i, n) => {
      const t = i / (n - 1);
      return stand({
        crouch: 1 + t * 1.2,
        lean: -4 * t,
        footFront: { x: 30 + t * 6, y: 46 },
        footBack: { x: 14 - t * 4, y: 46 },
        handFront: { x: 30 + t * 8, y: 40 },
        handBack: { x: 15 - t * 6, y: 41 },
        headLean: -1 * t
      });
    }
  }),
  getup: animationFrames({
    length: 10,
    fps: 14,
    loop: false,
    poseAt: (i, n) => {
      const t = 1 - i / (n - 1);
      return stand({
        crouch: 1 + t * 1.2,
        lean: -3 * t,
        footFront: { x: 26 + t * 6, y: 45 },
        footBack: { x: 18 - t * 4, y: 45 },
        handFront: { x: 28, y: 32 }
      });
    }
  }),
  victory: animationFrames({
    length: 14,
    fps: 14,
    loop: false,
    poseAt: (i) => {
      const ph = (i / 14) * Math.PI * 3;
      return { ...POSE_VICTORY, handFront: { x: 27 + Math.sin(ph) * 2, y: 12 + Math.cos(ph) * 2 }, headLean: Math.sin(ph) * 0.5 };
    }
  }),
  defeat: animationFrames({
    length: 12,
    fps: 12,
    loop: false,
    poseAt: (i, n) => {
      const t = i / (n - 1);
      return {
        crouch: 1 + t * 1.6,
        lean: -5 * t,
        footFront: { x: 32, y: 46 },
        footBack: { x: 12, y: 46 },
        handFront: { x: 33, y: 43 - t * 2 },
        handBack: { x: 11, y: 42 },
        headLean: -1.5 * t
      };
    }
  })
};

function renderEffect(count, drawAt) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    const canvas = new Canvas();
    drawAt(canvas, i, count);
    frames.push(canvas);
  }
  return frames;
}

const EFFECTS = {
  hitSpark: renderEffect(5, (c, i, n) => {
    const t = i / (n - 1);
    const r = 1 + t * 8;
    const color = i < 2 ? PAL.spark : PAL.sparkEdge;
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      c.limb(24, 24, 24 + Math.cos(ang) * r, 24 + Math.sin(ang) * r, 1, k % 2 ? color : PAL.spinkle ?? color);
    }
    if (i < 3) c.rect(22, 22, 5, 5, PAL.spark);
  }),
  slashTrail: renderEffect(6, (c, i, n) => {
    const t = i / (n - 1);
    const r = 6 + t * 14;
    for (let k = 30; k < 150; k += 2) {
      const ang = (k * Math.PI) / 180;
      c.px(18 + Math.cos(ang) * r, 26 + Math.sin(ang) * r, t < 0.5 ? PAL.slash : PAL.sparkEdge);
    }
  }),
  dust: renderEffect(6, (c, i, n) => {
    const t = (i + 1) / n;
    for (let k = 0; k < 6; k++) {
      const spread = t * 10;
      c.rect(24 + (k % 3 - 1) * spread, 36 + k - t * 6, 2, 2, PAL.dust);
    }
  }),
  energyGlow: renderEffect(8, (c, i, n) => {
    const t = Math.sin((i / (n - 1)) * Math.PI);
    const r = Math.round(2 + t * 5);
    c.rect(24 - r, 24 - r, r * 2, r * 2, PAL.aura);
    c.rect(24 - Math.round(r / 2), 24 - Math.round(r / 2), Math.round(r), Math.round(r), PAL.auraCore);
  })
};

function writeSheet(name, frames, outDir) {
  const sheet = new Canvas(frames[0].w * frames.length, frames[0].h);
  frames.forEach((f, i) => {
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        const src = (y * f.w + x) * 4;
        const dst = ((y * sheet.w) + i * f.w + x) * 4;
        sheet.data.set(f.data.subarray(src, src + 4), dst);
      }
    }
  });
  writeFileSync(join(outDir, `${name}${name.startsWith('fx_') ? '' : ''}.png`), encodePNG(sheet.w, sheet.h, sheet.data));
}

const EVENTS_BY_ATTACK = {
  light: [
    { frame: 4, type: 'activateHitbox' },
    { frame: 7, type: 'deactivateHitbox' },
    { frame: 7, type: 'playSound', params: { id: 'hit_light' } }
  ],
  medium: [
    { frame: 8, type: 'activateHitbox' },
    { frame: 13, type: 'deactivateHitbox' },
    { frame: 13, type: 'playSound', params: { id: 'hit_medium' } }
  ],
  heavy: [
    { frame: 15, type: 'activateHitbox' },
    { frame: 21, type: 'deactivateHitbox' },
    { frame: 21, type: 'playSound', params: { id: 'hit_heavy' } },
    { frame: 21, type: 'spawnParticle', params: { id: 'fx_energyGlow' } }
  ],
  airAttack: [
    { frame: 5, type: 'activateHitbox' },
    { frame: 9, type: 'deactivateHitbox' },
    { frame: 9, type: 'playSound', params: { id: 'hit_air' } }
  ],
  dashAttack: [
    { frame: 6, type: 'activateHitbox' },
    { frame: 11, type: 'deactivateHitbox' },
    { frame: 11, type: 'playSound', params: { id: 'hit_medium' } }
  ]
};

const ANIM_EVENTS = {
  idle: [], walk: [], run: [], jump: [], fall: [], dash: [], guard: [],
  hitReaction: [], knockdown: [], getup: [], victory: [], defeat: [],
  light: EVENTS_BY_ATTACK.light || [],
  medium: EVENTS_BY_ATTACK.medium || [],
  heavy: EVENTS_BY_ATTACK.heavy || [],
  airAttack: EVENTS_BY_ATTACK.airAttack || [],
  dashAttack: EVENTS_BY_ATTACK.dashAttack || []
};

const MANIFEST = {
  format: 1,
  frameWidth: FW,
  frameHeight: FH,
  hitboxes: {
    fighter_001: {
      body: { x: 20, y: 14, width: 16, height: 32 },
      head: { x: 20, y: 10, width: 14, height: 10 },
      upper: { x: 18, y: 22, width: 20, height: 12 },
      lower: { x: 20, y: 25, width: 16, height: 20 }
    }
  },
  animations: {},
  effects: {}
};

const animDir = join(OUT_ROOT, 'characters/fighter_001');
mkdirSync(animDir, { recursive: true });

for (const [name, { frames, fps, loop }] of Object.entries(ANIMATIONS)) {
  writeSheet(name, frames, animDir);
  MANIFEST.animations[name] = {
    frameCount: frames.length,
    fps,
    loop,
    frameWidth: FW,
    frameHeight: FH,
    file: `assets/characters/fighter_001/${name}.png`,
    events: ANIM_EVENTS[name] ?? []
  };
}

const fxDir = join(OUT_ROOT, 'effects');
mkdirSync(fxDir, { recursive: true });
for (const [name, frames] of Object.entries(EFFECTS)) {
  const file = `assets/effects/fx_${name}.png`;
  writeSheet(`fx_${name}`, frames, fxDir);
  MANIFEST.effects[name] = { frameCount: frames.length, fps: 30, loop: false, file };
}

const dataDir = new URL('../public/data/characters/', import.meta.url).pathname;
mkdirSync(dataDir, { recursive: true });
writeFileSync(join(dataDir, 'fighter_001.manifest.json'), JSON.stringify(MANIFEST, null, 2));

let totalFrames = 0;
for (const [, meta] of Object.entries(MANIFEST.animations)) totalFrames += meta.frameCount;
console.log(`sprites generated: ${Object.keys(ANIMATIONS).length} animations, ${totalFrames} frames, ${Object.keys(EFFECTS).length} effects`);
