import Phaser from 'phaser';

const ASSET_ROOT = '/assets/technical-slice';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.svg('building-bank', `${ASSET_ROOT}/building-bank.svg`, { width: 280, height: 280 });
    this.load.svg('building-market', `${ASSET_ROOT}/building-market.svg`, { width: 280, height: 280 });
    this.load.svg('building-home-a', `${ASSET_ROOT}/building-home-a.svg`, { width: 280, height: 280 });
    this.load.svg('building-home-b', `${ASSET_ROOT}/building-home-b.svg`, { width: 280, height: 280 });
    this.load.svg('building-card-shop', `${ASSET_ROOT}/building-card-shop.svg`, { width: 280, height: 280 });
    this.load.svg('building-event-hall', `${ASSET_ROOT}/building-event-hall.svg`, { width: 280, height: 280 });
    this.load.svg('pawn-cat', `${ASSET_ROOT}/pawn-cat.svg`, { width: 160, height: 210 });
    this.load.svg('pawn-bear', `${ASSET_ROOT}/pawn-bear.svg`, { width: 160, height: 210 });
  }

  create(): void {
    this.scene.start('TownScene');
  }
}
