import { createGame } from './gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { TrainingScene } from './scenes/TrainingScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';

const boot = document.getElementById('boot');
const parent = document.getElementById('game');
if (!parent) throw new Error('missing #game mount');
const game = createGame(parent);
game.scene.add('Boot', BootScene, true);
game.scene.add('MainMenu', MainMenuScene);
game.scene.add('Battle', BattleScene);
game.scene.add('Training', TrainingScene);
game.scene.add('Settings', SettingsScene);

if (boot) {
  const hide = (): void => {
    boot.style.display = 'none';
    window.removeEventListener('pointerdown', hide);
    window.removeEventListener('keydown', hide);
  };
  setTimeout(hide, 50);
  window.addEventListener('keydown', hide);
}
