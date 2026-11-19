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

window.addEventListener('pra-booted', hideBoot);
window.addEventListener('error', (event) => {
  if (boot && boot.style.display !== 'none') showBootError(event.message);
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
