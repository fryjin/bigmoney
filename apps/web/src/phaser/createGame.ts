import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TownScene } from './scenes/TownScene';

export function createTownGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#DCEBE6',
    width: 1194,
    height: 834,
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    render: {
      antialias: true,
      roundPixels: true
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1194,
      height: 834
    },
    scene: [BootScene, TownScene]
  });
}
