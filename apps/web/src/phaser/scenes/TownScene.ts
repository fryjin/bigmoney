import Phaser from 'phaser';
import { gameEvents, SceneEvents } from '../bridges/gameEvents';

const nodes = [
  { x: 180, y: 510 },
  { x: 300, y: 570 },
  { x: 430, y: 505 },
  { x: 560, y: 440 },
  { x: 680, y: 380 },
  { x: 560, y: 315 },
  { x: 430, y: 380 },
  { x: 300, y: 445 }
];

export class TownScene extends Phaser.Scene {
  private pawn?: Phaser.GameObjects.Container;
  private pawnPosition = 0;

  constructor() {
    super('TownScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#DDEBE7');
    this.drawTechnicalSlice();
    this.pawn = this.createPawn(nodes[0]!.x, nodes[0]!.y);

    gameEvents.on(SceneEvents.pawnMove, this.movePawn, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameEvents.off(SceneEvents.pawnMove, this.movePawn, this);
    });
  }

  private drawTechnicalSlice(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x6f858d, 1);
    graphics.lineStyle(2, 0xe8ddaf, 0.9);

    for (let index = 0; index < nodes.length; index += 1) {
      const current = nodes[index]!;
      const next = nodes[(index + 1) % nodes.length]!;
      graphics.lineBetween(current.x, current.y, next.x, next.y);
    }

    for (const [index, node] of nodes.entries()) {
      const diamond = new Phaser.Geom.Polygon([
        node.x, node.y - 28,
        node.x + 50, node.y,
        node.x, node.y + 28,
        node.x - 50, node.y
      ]);
      graphics.fillStyle(index % 2 === 0 ? 0xf4f0df : 0xd5e7df, 1);
      graphics.fillPoints(diamond.points, true);
      graphics.lineStyle(2, 0x48636b, 0.45);
      graphics.strokePoints(diamond.points, true);
    }

    const buildingData = [
      { x: 250, y: 300, width: 100, height: 130, color: 0x72b8a6 },
      { x: 390, y: 250, width: 120, height: 180, color: 0x6e9fb4 },
      { x: 550, y: 230, width: 115, height: 150, color: 0xe7896f },
      { x: 720, y: 310, width: 100, height: 125, color: 0xe6c86e },
      { x: 740, y: 500, width: 110, height: 145, color: 0x72b8a6 },
      { x: 520, y: 610, width: 130, height: 165, color: 0x6e9fb4 }
    ];

    buildingData.forEach((data) => this.createPlaceholderBuilding(data));
  }

  private createPlaceholderBuilding(data: { x: number; y: number; width: number; height: number; color: number }): void {
    const shadow = this.add.ellipse(data.x + 12, data.y + 8, data.width * 1.3, data.width * 0.45, 0x20343b, 0.12);
    const body = this.add.rectangle(data.x, data.y - data.height / 2, data.width, data.height, data.color);
    const roof = this.add.polygon(data.x, data.y - data.height, [
      -data.width / 2, 0,
      0, -data.width * 0.28,
      data.width / 2, 0,
      0, data.width * 0.28
    ], 0xf7f3e8);
    const depth = data.y;
    shadow.setDepth(depth - 2);
    body.setDepth(depth - 1);
    roof.setDepth(depth);
  }

  private createPawn(x: number, y: number): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(0, 8, 34, 14, 0x20343b, 0.18);
    const body = this.add.circle(0, -12, 17, 0xe7896f);
    const head = this.add.circle(0, -34, 12, 0xffeee6);
    const pawn = this.add.container(x, y, [shadow, body, head]);
    pawn.setDepth(y + 20);
    return pawn;
  }

  private movePawn(targetPosition: number): void {
    if (!this.pawn) return;
    const target = nodes[targetPosition];
    if (!target) return;
    this.pawnPosition = targetPosition;
    this.tweens.add({
      targets: this.pawn,
      x: target.x,
      y: target.y,
      duration: 240,
      ease: 'Sine.Out',
      onUpdate: () => this.pawn?.setDepth((this.pawn?.y ?? 0) + 20)
    });
  }
}
