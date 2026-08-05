import Phaser from 'phaser';

export const gameEvents = new Phaser.Events.EventEmitter();

export const SceneEvents = {
  pawnMove: 'scene:pawn-move',
  propertyPurchased: 'scene:property-purchased'
} as const;
