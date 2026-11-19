import { createGame } from './gameConfig.js';
import { getBootData, loadGameData, setBootData, validateData } from './core/DataLoader.js';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { TrainingScene } from './scenes/TrainingScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';

const boot = document.getElementById('boot');
const parent = document.getElementById('game');
if (!parent) throw new Error('missing #game mount');
const mount: HTMLElement = parent;

const showBootError = (message: string): void => {
  if (boot) {
    boot.style.color = '#ff8a8a';
    boot.textContent = `BOOT ERROR: ${message}`;
  } else {
    console.error(`[pra] boot error: ${message}`);
  }
};

const hideBoot = (): void => {
  if (boot) boot.style.display = 'none';
  window.removeEventListener('pra-booted', hideBoot);
};

let assetWarn: HTMLElement | null = null;
window.addEventListener('pra-asset-warning', (event) => {
  const detail = (event as CustomEvent<string[]>).detail ?? [];
  if (detail.length === 0) return;
  if (!assetWarn) {
    assetWarn = document.createElement('pre');
    assetWarn.style.cssText = 'position:fixed;bottom:8px;left:8px;margin:0;padding:6px 10px;background:#3a0d0d;color:#ffb0b0;font:12px monospace;white-space:pre-wrap;z-index:999;max-width:60vw;border:1px solid #ff8a8a;';
    document.body.appendChild(assetWarn);
  }
  assetWarn.textContent = `MISSING ASSETS (${detail.length}): ${detail.slice(0, 6).join(', ')}${detail.length > 6 ? ' ...' : ''}`;
});
window.addEventListener('pra-booted', hideBoot);
window.addEventListener('error', (event) => {
  if (boot && boot.style.display !== 'none') showBootError(event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
  if (boot && boot.style.display !== 'none') showBootError(message);
});

async function bootGame(mount: HTMLElement): Promise<void> {
  try {
    const data = await loadGameData();
    const errors = validateData(data);
    if (errors.length > 0) throw new Error(`animation validation failed: ${errors.join(', ')}`);
    setBootData(data);
  } catch (error) {
    showBootError((error as Error).message);
    return;
  }
  getBootData();
  const game = createGame(mount);
  game.scene.add('Boot', BootScene, true);
  game.scene.add('MainMenu', MainMenuScene);
  game.scene.add('Battle', BattleScene);
  game.scene.add('Training', TrainingScene);
  game.scene.add('Settings', SettingsScene);
}

void bootGame(mount);
