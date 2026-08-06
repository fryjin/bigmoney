import Phaser from 'phaser';
import type { DomainEvent, GameState, PlayerId } from '@bigmoney/game-core';
import type { PresentationCue } from '@bigmoney/game-flow';
import {
  getPresentationProfile,
  type PresentationPreferences
} from '../../presentation/preferences';
import {
  getVisualAsset,
  isVisualAssetId,
  type VisualAssetId
} from '../assets/visualAssetRegistry';
import {
  completeScenePresentation,
  notifySceneReady,
  notifySceneShutdown,
  getScenePresentationPreferences,
  offScenePreferences,
  offScenePresentation,
  offSceneSync,
  onScenePreferences,
  onScenePresentation,
  onSceneSync
} from '../bridges/sceneBridge';
import {
  PROPERTY_VISUALS,
  TECHNICAL_SLICE_NODES
} from '../maps/technicalSliceLayout';

const PLAYER_TEXTURES: Record<string, VisualAssetId> = {
  P1: 'pawn-cat',
  P2: 'pawn-bear'
};

const PLAYER_OFFSETS: Record<string, { x: number; y: number }> = {
  P1: { x: -14, y: 0 },
  P2: { x: 16, y: 5 }
};

export class TownScene extends Phaser.Scene {
  private readonly pawns = new Map<PlayerId, Phaser.GameObjects.Image>();
  private readonly tileShapes = new Map<string, Phaser.GameObjects.Polygon>();
  private readonly propertyBuildings = new Map<string, Phaser.GameObjects.Image>();
  private readonly propertyBadges = new Map<string, Phaser.GameObjects.Text>();
  private readonly propertyFlags = new Map<string, Phaser.GameObjects.Container>();
  private readonly trafficObjects: Phaser.GameObjects.Container[] = [];
  private preferences: PresentationPreferences = getScenePresentationPreferences();
  private activePlayerRing?: Phaser.GameObjects.Ellipse;
  private dice?: Phaser.GameObjects.Container;
  private dicePips: Phaser.GameObjects.Arc[] = [];
  private marketBuilding?: Phaser.GameObjects.Image;

  constructor() {
    super('TownScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#DCEBE6');
    this.cameras.main.setBounds(0, 0, 1194, 834);
    this.drawCityBase();
    this.drawRoadLoop();
    this.drawTiles();
    this.placeBuildings();
    this.placeCityDetails();
    this.createPawns();
    this.createActivePlayerRing();
    this.createDice();
    this.applyPresentationPreferences(this.preferences);

    onScenePreferences(this.applyPresentationPreferences, this);
    onScenePresentation(this.handlePresentation, this);
    onSceneSync(this.syncState, this);
    notifySceneReady();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offScenePreferences(this.applyPresentationPreferences, this);
      offScenePresentation(this.handlePresentation, this);
      offSceneSync(this.syncState, this);
      notifySceneShutdown();
    });
  }

  private drawCityBase(): void {
    const baseShadow = this.add.polygon(603, 452, [
      -520, -290,
      420, -290,
      540, -205,
      540, 244,
      430, 312,
      -430, 312,
      -540, 225,
      -540, -205
    ], 0x20343b, 0.13);
    baseShadow.setDepth(-30);

    const island = this.add.polygon(590, 430, [
      -520, -290,
      420, -290,
      540, -205,
      540, 244,
      430, 312,
      -430, 312,
      -540, 225,
      -540, -205
    ], 0xf4f1e7, 1);
    island.setStrokeStyle(3, 0xffffff, 0.75);
    island.setDepth(-25);

    const grass = this.add.polygon(590, 420, [
      -480, -250,
      390, -250,
      490, -180,
      490, 208,
      390, 270,
      -390, 270,
      -490, 200,
      -490, -180
    ], 0xbfd9c6, 1);
    grass.setDepth(-20);

    const lake = this.add.ellipse(190, 250, 240, 120, 0x86c9d6, 1);
    lake.setStrokeStyle(8, 0xe7f2ed, 1);
    lake.setDepth(-14);
    this.add.ellipse(190, 244, 170, 68, 0xb6e4e7, 0.65).setDepth(-13);

    const plaza = this.add.polygon(846, 604, [
      -120, 0,
      0, -60,
      120, 0,
      0, 60
    ], 0xe3d9c7, 1);
    plaza.setStrokeStyle(2, 0xffffff, 0.8);
    plaza.setDepth(-12);

    for (let index = 0; index < 5; index += 1) {
      this.add.circle(846 + Math.cos(index * 1.25) * 42, 604 + Math.sin(index * 1.25) * 20, 4, 0xffffff, 0.75)
        .setDepth(-11);
    }
  }

  private drawRoadLoop(): void {
    const graphics = this.add.graphics();
    graphics.setDepth(-8);

    const pairs = TECHNICAL_SLICE_NODES.map((node, index) => [
      node,
      TECHNICAL_SLICE_NODES[(index + 1) % TECHNICAL_SLICE_NODES.length]!
    ] as const);

    graphics.lineStyle(92, 0xe9e3d7, 1);
    for (const [from, to] of pairs) graphics.lineBetween(from.x, from.y, to.x, to.y);

    graphics.lineStyle(72, 0x415b64, 1);
    for (const [from, to] of pairs) graphics.lineBetween(from.x, from.y, to.x, to.y);

    graphics.lineStyle(2, 0xf8f7ed, 0.58);
    for (const [from, to] of pairs) {
      const sections = 8;
      for (let section = 0; section < sections; section += 2) {
        const start = section / sections;
        const end = Math.min((section + 0.7) / sections, 1);
        graphics.lineBetween(
          Phaser.Math.Linear(from.x, to.x, start),
          Phaser.Math.Linear(from.y, to.y, start),
          Phaser.Math.Linear(from.x, to.x, end),
          Phaser.Math.Linear(from.y, to.y, end)
        );
      }
    }

    this.drawCrosswalk(graphics, 418, 662, -25);
    this.drawCrosswalk(graphics, 814, 463, -25);
    this.drawCrosswalk(graphics, 630, 365, 24);
  }

  private drawCrosswalk(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    rotationDegrees: number
  ): void {
    const radians = Phaser.Math.DegToRad(rotationDegrees);
    for (let index = -2; index <= 2; index += 1) {
      const offset = index * 10;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const cx = x + offset * cos;
      const cy = y + offset * sin;
      const perpendicularX = -sin * 20;
      const perpendicularY = cos * 20;
      graphics.lineStyle(6, 0xf8f7ed, 0.88);
      graphics.lineBetween(
        cx - perpendicularX,
        cy - perpendicularY,
        cx + perpendicularX,
        cy + perpendicularY
      );
    }
  }

  private drawTiles(): void {
    const tones: Record<string, number> = {
      start: 0xcfe7dd,
      property: 0xf5f0e2,
      event: 0xf5d7ce,
      stock: 0xd5e5f1,
      card: 0xf4e6ae,
      finish: 0xc9d8df
    };

    for (const node of TECHNICAL_SLICE_NODES) {
      const tile = this.add.polygon(node.x, node.y, [
        -56, 0,
        0, -31,
        56, 0,
        0, 31
      ], tones[node.tone] ?? 0xffffff, 0.96);
      tile.setStrokeStyle(3, 0xffffff, 0.82);
      tile.setDepth(node.y - 5);
      this.tileShapes.set(node.tileId, tile);

      const label = this.add.text(node.x, node.y + 10, node.label, {
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#24383f',
        align: 'center'
      });
      label.setOrigin(0.5, 0);
      label.setDepth(node.y + 3);
    }
  }

  private placeBuildings(): void {
    this.createVisualAssetImage('building-bank', 788, 490);

    this.marketBuilding = this.createVisualAssetImage('building-market', 794, 402);

    this.createVisualAssetImage('building-event-hall', 444, 564);
    this.createVisualAssetImage('building-card-shop', 820, 288);

    for (const [propertyId, visual] of Object.entries(PROPERTY_VISUALS)) {
      if (!isVisualAssetId(visual.buildingKey)) continue;
      const building = this.createVisualAssetImage(
        visual.buildingKey,
        visual.x,
        visual.y
      );
      this.propertyBuildings.set(propertyId, building);

      const badge = this.add.text(visual.x + 52, visual.y - 112, 'L0', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#22343A',
        padding: { x: 8, y: 5 }
      });
      badge.setOrigin(0.5).setDepth(visual.y + 30);
      this.propertyBadges.set(propertyId, badge);
    }
  }

  private placeCityDetails(): void {
    const treePositions = [
      [108, 350], [150, 330], [248, 260], [300, 250],
      [1042, 270], [1080, 314], [1030, 630], [1100, 610],
      [650, 690], [720, 688], [410, 250], [470, 236]
    ] as const;
    treePositions.forEach(([x, y], index) => this.createTree(x, y, 0.76 + (index % 3) * 0.08));

    this.trafficObjects.push(
      this.createCar(258, 568, 0xe87a68, -18),
      this.createCar(624, 548, 0xf1eee5, -25),
      this.createCar(826, 500, 0x7bb0c2, -25),
      this.createCar(620, 370, 0xe3b851, 24)
    );

    this.createStreetLight(370, 640);
    this.createStreetLight(586, 572);
    this.createStreetLight(850, 442);
    this.createStreetLight(668, 334);

    const fountainBase = this.add.ellipse(848, 600, 82, 38, 0xb7c8c6, 1).setDepth(596);
    fountainBase.setStrokeStyle(4, 0xffffff, 0.75);
    this.add.ellipse(848, 596, 54, 24, 0x79c0d2, 0.9).setDepth(597);
    this.add.circle(848, 582, 8, 0xf2f5ef, 1).setDepth(598);
  }

  private createTree(x: number, y: number, scale: number): void {
    const shadow = this.add.ellipse(0, 5, 48, 18, 0x263c43, 0.13);
    const trunk = this.add.rectangle(0, -18, 9, 36, 0x8a684c);
    const crownBottom = this.add.circle(0, -45, 27, 0x4f9b71);
    const crownMiddle = this.add.circle(0, -68, 22, 0x63ad7c);
    const crownTop = this.add.circle(0, -87, 16, 0x78bd8d);
    const tree = this.add.container(x, y, [shadow, trunk, crownBottom, crownMiddle, crownTop]);
    tree.setScale(scale).setDepth(y);
  }

  private createCar(
    x: number,
    y: number,
    color: number,
    angle: number
  ): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(0, 8, 64, 23, 0x20343b, 0.16);
    const body = this.add.rectangle(0, 0, 58, 28, color).setStrokeStyle(2, 0xffffff, 0.45);
    const cabin = this.add.rectangle(2, -12, 32, 20, 0xd9eef1).setStrokeStyle(2, 0x294149, 0.35);
    const car = this.add.container(x, y, [shadow, body, cabin]);
    car.setAngle(angle).setDepth(y + 4);
    return car;
  }

  private createStreetLight(x: number, y: number): void {
    const pole = this.add.rectangle(0, -25, 4, 50, 0x334a51);
    const lamp = this.add.circle(0, -51, 7, 0xffe7a2);
    const light = this.add.container(x, y, [pole, lamp]);
    light.setDepth(y);
  }

  private createPawns(): void {
    const start = TECHNICAL_SLICE_NODES[0]!;
    for (const playerId of ['P1', 'P2']) {
      const offset = PLAYER_OFFSETS[playerId]!;
      const pawn = this.createVisualAssetImage(
        PLAYER_TEXTURES[playerId]!,
        start.x + offset.x,
        start.y + offset.y
      );
      this.pawns.set(playerId, pawn);
    }
  }

  private createActivePlayerRing(): void {
    const start = TECHNICAL_SLICE_NODES[0]!;
    this.activePlayerRing = this.add.ellipse(
      start.x,
      start.y + 13,
      76,
      34,
      0xffffff,
      0.16
    );
    this.activePlayerRing
      .setStrokeStyle(4, 0xe87868, 0.92)
      .setDepth(start.y + 39);
  }

  private createVisualAssetImage(
    assetId: VisualAssetId,
    x: number,
    y: number
  ): Phaser.GameObjects.Image {
    const asset = getVisualAsset(assetId);
    const image = this.add.image(x, y, asset.key);
    image
      .setOrigin(asset.origin.x, asset.origin.y)
      .setDisplaySize(asset.displaySize.width, asset.displaySize.height)
      .setDepth(y + asset.depthOffset);
    return image;
  }

  private applyPresentationPreferences(
    next: PresentationPreferences
  ): void {
    this.preferences = { ...next };
    const profile = getPresentationProfile(next);
    for (const traffic of this.trafficObjects) {
      traffic.setVisible(profile.showTraffic);
    }
  }

  private createDice(): void {
    const shadow = this.add.ellipse(0, 22, 98, 34, 0x20343b, 0.18);
    const body = this.add.rectangle(0, 0, 84, 84, 0xfdfcf6)
      .setStrokeStyle(4, 0x22343a, 0.24);
    const pips = Array.from({ length: 7 }, () => this.add.circle(0, 0, 6, 0x22343a));
    this.dicePips = pips;
    this.dice = this.add.container(1005, 650, [shadow, body, ...pips]);
    this.dice.setDepth(900).setVisible(false);
    this.setDiceFace(1);
  }

  private setDiceFace(value: number): void {
    const positions = [
      { x: -22, y: -22 },
      { x: 0, y: -22 },
      { x: 22, y: -22 },
      { x: -22, y: 0 },
      { x: 0, y: 0 },
      { x: 22, y: 0 },
      { x: -22, y: 22 },
      { x: 0, y: 22 },
      { x: 22, y: 22 }
    ];

    const indicesByValue: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };

    this.dicePips.forEach((pip) => pip.setVisible(false));
    const selected = indicesByValue[value] ?? indicesByValue[1]!;
    selected.forEach((positionIndex, pipIndex) => {
      const position = positions[positionIndex]!;
      const pip = this.dicePips[pipIndex];
      pip?.setPosition(position.x, position.y).setVisible(true);
    });
  }

  private handlePresentation(cue: PresentationCue): void {
    void this.playPresentation(cue);
  }

  private async playPresentation(cue: PresentationCue): Promise<void> {
    try {
      if (cue.kind === 'ROLL') await this.playRoll(cue.events);
      if (cue.kind === 'MOVE') await this.playMove(cue.events);
      if (cue.kind === 'STOCK') await this.playStock(cue.events);
      if (cue.kind === 'PROPERTY') await this.playProperty(cue.events);
      if (cue.kind === 'UPGRADE') await this.playUpgrade(cue.events);
      if (cue.kind === 'DESTINATION') await this.playDestination(cue.events);
      if (cue.kind === 'TURN') await this.playTurn(cue.events);
    } finally {
      completeScenePresentation(cue.id);
    }
  }

  private async playRoll(events: DomainEvent[]): Promise<void> {
    const event = events.find((candidate) => candidate.type === 'DICE_ROLLED');
    if (!event || event.type !== 'DICE_ROLLED' || !this.dice) return;

    this.setDiceFace(event.value);
    this.dice.setVisible(true).setScale(0.72).setAngle(-18).setAlpha(0.4);
    await this.tween({
      targets: this.dice,
      scale: 1,
      angle: 360 + event.value * 18,
      alpha: 1,
      duration: 620,
      ease: 'Back.Out'
    });
    await this.delay(190);
    await this.tween({
      targets: this.dice,
      scale: 0.86,
      alpha: 0,
      duration: 190,
      ease: 'Sine.In'
    });
    this.dice.setVisible(false);
  }

  private async playMove(events: DomainEvent[]): Promise<void> {
    const event = events.find((candidate) => candidate.type === 'PLAYER_MOVED');
    if (!event || event.type !== 'PLAYER_MOVED') return;
    const pawn = this.pawns.get(event.playerId);
    const target = TECHNICAL_SLICE_NODES[event.to];
    if (!pawn || !target) return;

    const offset = PLAYER_OFFSETS[event.playerId] ?? { x: 0, y: 0 };
    const startX = pawn.x;
    const startY = pawn.y;
    const endX = target.x + offset.x;
    const endY = target.y + offset.y;
    const proxy = { t: 0 };

    await this.tween({
      targets: proxy,
      t: 1,
      duration: 340,
      ease: 'Sine.InOut',
      onUpdate: () => {
        pawn.x = Phaser.Math.Linear(startX, endX, proxy.t);
        pawn.y = Phaser.Math.Linear(startY, endY, proxy.t) - Math.sin(proxy.t * Math.PI) * 30;
        pawn.setDepth(pawn.y + 44);
      }
    });

    pawn.setPosition(endX, endY).setDepth(endY + 44);
    await this.pulseTile(target.tileId);
  }

  private async playStock(events: DomainEvent[]): Promise<void> {
    if (!this.marketBuilding) return;
    const purchased = events.some((event) => event.type === 'STOCK_PURCHASED');
    await this.tween({
      targets: this.marketBuilding,
      scaleX: purchased ? 1.08 : 1.03,
      scaleY: purchased ? 1.08 : 1.03,
      duration: 190,
      yoyo: true,
      ease: 'Sine.InOut'
    });
  }

  private async playProperty(events: DomainEvent[]): Promise<void> {
    const purchase = events.find((event) => event.type === 'PROPERTY_PURCHASED');
    if (!purchase || purchase.type !== 'PROPERTY_PURCHASED') {
      await this.delay(150);
      return;
    }

    this.ensurePropertyFlag(purchase.propertyId, purchase.playerId);
    const flag = this.propertyFlags.get(purchase.propertyId);
    if (!flag) return;
    flag.setScale(0.2).setAlpha(0);
    await this.tween({
      targets: flag,
      scale: 1,
      alpha: 1,
      duration: 420,
      ease: 'Back.Out'
    });
  }

  private async playUpgrade(events: DomainEvent[]): Promise<void> {
    const upgrade = events.find((event) => event.type === 'PROPERTY_UPGRADED');
    if (!upgrade || upgrade.type !== 'PROPERTY_UPGRADED') {
      await this.delay(150);
      return;
    }

    const building = this.propertyBuildings.get(upgrade.propertyId);
    const badge = this.propertyBadges.get(upgrade.propertyId);
    badge?.setText(`L${upgrade.level}`);
    if (!building) return;

    await this.tween({
      targets: building,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 220,
      yoyo: true,
      ease: 'Back.Out'
    });
  }

  private async playDestination(events: DomainEvent[]): Promise<void> {
    const rent = events.find((event) => event.type === 'RENT_PAID');
    if (!rent || rent.type !== 'RENT_PAID') return;

    const payer = this.pawns.get(rent.payerId);
    if (!payer) return;
    const text = this.add.text(payer.x, payer.y - 100, `-${rent.amount * 10}万`, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#C55353',
      stroke: '#FFFFFF',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(1100);

    await this.tween({
      targets: text,
      y: text.y - 44,
      alpha: 0,
      duration: 620,
      ease: 'Sine.Out'
    });
    text.destroy();
  }

  private async playTurn(events: DomainEvent[]): Promise<void> {
    const turn = events.find((event) => event.type === 'TURN_ENDED');
    if (!turn || turn.type !== 'TURN_ENDED') return;
    const pawn = this.pawns.get(turn.nextPlayerId);
    if (!pawn) return;

    await this.tween({
      targets: pawn,
      scaleX: 1.16,
      scaleY: 1.16,
      duration: 180,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.InOut'
    });
  }

  private async pulseTile(tileId: string): Promise<void> {
    const tile = this.tileShapes.get(tileId);
    if (!tile) return;
    await this.tween({
      targets: tile,
      scaleX: 1.09,
      scaleY: 1.09,
      alpha: 0.72,
      duration: 120,
      yoyo: true,
      ease: 'Sine.InOut'
    });
  }

  private syncState(state: GameState): void {
    for (const player of state.players) {
      const pawn = this.pawns.get(player.id);
      const node = TECHNICAL_SLICE_NODES[player.position];
      if (!pawn || !node) continue;
      const offset = PLAYER_OFFSETS[player.id] ?? { x: 0, y: 0 };
      pawn.setPosition(node.x + offset.x, node.y + offset.y);
      pawn.setDepth(node.y + offset.y + 44);
    }

    const activePlayer = state.players[state.activePlayerIndex];
    if (activePlayer) this.updateActivePlayerRing(activePlayer);

    for (const [propertyId, property] of Object.entries(state.properties)) {
      const badge = this.propertyBadges.get(propertyId);
      badge?.setText(`L${property.level}`);
      if (property.ownerId) {
        this.ensurePropertyFlag(propertyId, property.ownerId);
      } else {
        this.propertyFlags.get(propertyId)?.destroy();
        this.propertyFlags.delete(propertyId);
      }
    }
  }

  private updateActivePlayerRing(player: GameState['players'][number]): void {
    const pawn = this.pawns.get(player.id);
    if (!pawn || !this.activePlayerRing) return;

    const parsedColor = Number.parseInt(player.color.replace('#', ''), 16);
    const color = Number.isFinite(parsedColor) ? parsedColor : 0x4a9a7f;
    this.activePlayerRing
      .setPosition(pawn.x, pawn.y + 13)
      .setDepth(pawn.depth - 1)
      .setStrokeStyle(4, color, 0.92)
      .setVisible(true);
  }

  private ensurePropertyFlag(propertyId: string, ownerId: PlayerId): void {
    const existing = this.propertyFlags.get(propertyId);
    if (existing) {
      const cloth = existing.getAt(1) as Phaser.GameObjects.Rectangle | undefined;
      cloth?.setFillStyle(ownerId === 'P1' ? 0xe87868 : 0x4f8fb8);
      return;
    }

    const visual = PROPERTY_VISUALS[propertyId as keyof typeof PROPERTY_VISUALS];
    if (!visual) return;

    const pole = this.add.rectangle(0, -28, 4, 56, 0x2f454c);
    const cloth = this.add.rectangle(15, -46, 28, 18, ownerId === 'P1' ? 0xe87868 : 0x4f8fb8);
    const flag = this.add.container(visual.x + 62, visual.y - 8, [pole, cloth]);
    flag.setDepth(visual.y + 50);
    this.propertyFlags.set(propertyId, flag);
  }

  private tween(
    config: Phaser.Types.Tweens.TweenBuilderConfig
  ): Promise<void> {
    const profile = getPresentationProfile(this.preferences);
    const adjustedConfig: Phaser.Types.Tweens.TweenBuilderConfig = {
      ...config
    };

    if (typeof config.duration === 'number') {
      adjustedConfig.duration = Math.max(
        1,
        Math.round(config.duration * profile.durationScale)
      );
    }

    return new Promise((resolve) => {
      this.tweens.add({
        ...adjustedConfig,
        onComplete: () => resolve()
      });
    });
  }

  private delay(duration: number): Promise<void> {
    const profile = getPresentationProfile(this.preferences);
    const adjustedDuration = Math.max(
      1,
      Math.round(duration * profile.durationScale)
    );

    return new Promise((resolve) => {
      this.time.delayedCall(adjustedDuration, resolve);
    });
  }
}
