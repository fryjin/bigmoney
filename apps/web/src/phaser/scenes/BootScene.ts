import Phaser from 'phaser';
import { preloadVisualAssets } from '../assets/visualAssetRegistry';
import {
  notifySceneLoadError,
  notifySceneLoadProgress
} from '../bridges/sceneBridge';

interface LoaderFileLike {
  key?: string;
  src?: string | string[];
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.on('progress', this.handleProgress, this);
    this.load.on('loaderror', this.handleLoadError, this);
    preloadVisualAssets(this);
  }

  create(): void {
    notifySceneLoadProgress(1);
    this.load.off('progress', this.handleProgress, this);
    this.load.off('loaderror', this.handleLoadError, this);
    this.scene.start('TownScene');
  }

  private handleProgress(progress: number): void {
    notifySceneLoadProgress(progress);
  }

  private handleLoadError(file: LoaderFileLike): void {
    const source = Array.isArray(file.src) ? file.src.join(', ') : file.src;
    notifySceneLoadError(file.key ?? source ?? 'unknown-asset');
  }
}
