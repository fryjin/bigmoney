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
  notifyScenePresentationReady,
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
  getBoardPresentationLayout,
  type BoardTileTone,
  type BoardPresentationLayout,
  type PropertyPresentationAnchor
} from '../maps/boardPresentationLayout';
import {
  getPawnDisplayDepth,
  getPawnDisplayPosition,
  getPawnTexture,
  shouldShowActivePlayerRing,
  toPhaserDisplayColor
} from '../presentation/playerPresentation';

type PropertyPresentationObject =
  | Phaser.GameObjects.Container
  | Phaser.GameObjects.Image;

export class TownScene extends Phaser.Scene {
  private readonly pawns = new Map<PlayerId, Phaser.GameObjects.Image>();
  private readonly pawnSlots = new Map<
    PlayerId,
    { playerIndex: number; playerCount: number }
  >();
  private readonly tileShapes = new Map<string, Phaser.GameObjects.Polygon>();
  private readonly tileLabels: Phaser.GameObjects.Text[] = [];
  private readonly propertyBuildings = new Map<string, PropertyPresentationObject>();
  private readonly propertyBadges = new Map<string, Phaser.GameObjects.Text>();
  private readonly propertyFlags = new Map<string, Phaser.GameObjects.Container>();
  private readonly trafficObjects: Phaser.GameObjects.Container[] = [];
  private preferences: PresentationPreferences = getScenePresentationPreferences();
  private currentLayout: BoardPresentationLayout | null = null;
  private roadLoop?: Phaser.GameObjects.Graphics;
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
    this.placeCityLandmarks();
    this.placeCityDetails();
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

  private drawRoadLoop(layout: BoardPresentationLayout): void {
    const graphics = this.add.graphics();
    graphics.setDepth(-8);
    this.roadLoop = graphics;

    const pairs = layout.nodes.map((node, index) => [
      node,
      layout.nodes[(index + 1) % layout.nodes.length]!
    ] as const);

    graphics.lineStyle(layout.road.outerWidth, 0xe9e3d7, 1);
    for (const [from, to] of pairs) graphics.lineBetween(from.x, from.y, to.x, to.y);

    graphics.lineStyle(layout.road.innerWidth, 0x415b64, 1);
    for (const [from, to] of pairs) graphics.lineBetween(from.x, from.y, to.x, to.y);

    graphics.lineStyle(layout.road.dashWidth, 0xf8f7ed, 0.58);
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

    for (const crosswalk of layout.crosswalks) {
      this.drawCrosswalk(
        graphics,
        crosswalk.x,
        crosswalk.y,
        crosswalk.rotationDegrees
      );
    }
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

  private drawTiles(layout: BoardPresentationLayout): void {
    const tones: Record<BoardTileTone, number> = {
      start: 0xcfe7dd,
      property: 0xf5f0e2,
      event: 0xf5d7ce,
      stock: 0xd5e5f1,
      card: 0xf4e6ae,
      facility: 0xd8e6cc,
      reserved: 0xd9d8d1,
      finish: 0xc9d8df
    };

    for (const node of layout.nodes) {
      const tile = this.add.polygon(node.x, node.y, [
        -layout.tile.halfWidth, 0,
        0, -layout.tile.halfHeight,
        layout.tile.halfWidth, 0,
        0, layout.tile.halfHeight
      ], tones[node.tone] ?? 0xffffff, 0.96);
      tile.setStrokeStyle(3, 0xffffff, 0.82);
      tile.setDepth(node.y - 5);
      this.tileShapes.set(node.tileId, tile);

      const label = this.add.text(node.x, node.y + 10, node.label, {
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: `${layout.tile.labelFontSize}px`,
        fontStyle: 'bold',
        color: '#24383f',
        align: 'center'
      });
      label.setOrigin(0.5, 0);
      label.setDepth(node.y + 3);
      this.tileLabels.push(label);
    }
  }

  private placeCityLandmarks(): void {
    this.createVisualAssetImage('building-bank', 788, 490);

    this.marketBuilding = this.createVisualAssetImage('building-market', 794, 402);

    this.createVisualAssetImage('building-event-hall', 444, 564);
    this.createVisualAssetImage('building-card-shop', 820, 288);
  }

  private placePropertyMarkers(layout: BoardPresentationLayout): void {
    for (const anchor of layout.propertyAnchors) {
      const building = anchor.assetId && isVisualAssetId(anchor.assetId)
        ? this.createVisualAssetImage(anchor.assetId, anchor.x, anchor.y)
        : this.createPropertyMarker(anchor);
      this.propertyBuildings.set(anchor.propertyId, building);

      const badge = this.add.text(
        anchor.x + anchor.badgeOffset.x,
        anchor.y + anchor.badgeOffset.y,
        'L0',
        {
        fontFamily: 'Inter, sans-serif',
        fontSize: anchor.assetId ? '12px' : '10px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#22343A',
        padding: { x: 8, y: 5 }
        }
      );
      badge.setOrigin(0.5).setDepth(anchor.y + 30);
      this.propertyBadges.set(anchor.propertyId, badge);
    }
  }

  private createPropertyMarker(
    anchor: PropertyPresentationAnchor
  ): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(0, 12, 44, 14, 0x20343b, 0.16);
    const base = this.add.rectangle(0, 0, 38, 28, 0xe6d7bc)
      .setStrokeStyle(2, 0xffffff, 0.82);
    const roof = this.add.triangle(0, -19, -22, 12, 22, 12, 0, -16, 0xb98f6b);
    const marker = this.add.container(anchor.x, anchor.y, [shadow, base, roof]);
    marker.setDepth(anchor.y + 20);
    return marker;
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

  private ensurePlayerPawns(players: GameState['players']): void {
    const playerIds = new Set(players.map((player) => player.id));
    for (const [playerId, pawn] of this.pawns) {
      if (playerIds.has(playerId)) continue;
      this.tweens.killTweensOf(pawn);
      pawn.destroy();
      this.pawns.delete(playerId);
      this.pawnSlots.delete(playerId);
    }

    players.forEach((player, playerIndex) => {
      const texture = getPawnTexture(playerIndex);
      const existing = this.pawns.get(player.id);
      const pawn = existing ?? this.createVisualAssetImage(texture, 0, 0);
      if (!existing) this.pawns.set(player.id, pawn);

      const asset = getVisualAsset(texture);
      pawn
        .setTexture(asset.key)
        .setOrigin(asset.origin.x, asset.origin.y)
        .setDisplaySize(asset.displaySize.width, asset.displaySize.height)
        .setAlpha(player.bankrupt ? 0.38 : 1)
        .setVisible(true);

      pawn.setData('displayColor', toPhaserDisplayColor(player.color));

      if (playerIndex < 2) pawn.clearTint();
      else pawn.setTint(toPhaserDisplayColor(player.color));

      this.pawnSlots.set(player.id, {
        playerIndex,
        playerCount: players.length
      });
    });
  }

  private createActivePlayerRing(layout: BoardPresentationLayout): void {
    const start = layout.nodes[0];
    if (!start) return;
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
      .setDepth(start.y + 39)
      .setVisible(false);
  }

  private ensureBoardPresentation(layout: BoardPresentationLayout): void {
    if (this.currentLayout?.boardVersion === layout.boardVersion) return;

    this.clearBoardPresentation();
    this.currentLayout = layout;
    this.drawRoadLoop(layout);
    this.drawTiles(layout);
    this.placePropertyMarkers(layout);
    this.createActivePlayerRing(layout);
  }

  private clearBoardPresentation(): void {
    this.roadLoop?.destroy();
    delete this.roadLoop;

    for (const tile of this.tileShapes.values()) tile.destroy();
    this.tileShapes.clear();
    this.tileLabels.forEach((label) => label.destroy());
    this.tileLabels.length = 0;

    for (const building of this.propertyBuildings.values()) building.destroy();
    this.propertyBuildings.clear();
    for (const badge of this.propertyBadges.values()) badge.destroy();
    this.propertyBadges.clear();
    for (const flag of this.propertyFlags.values()) flag.destroy();
    this.propertyFlags.clear();

    this.activePlayerRing?.destroy();
    delete this.activePlayerRing;
    this.currentLayout = null;
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
    const target = this.currentLayout?.nodes[event.to];
    if (!pawn || !target) return;

    const slot = this.pawnSlots.get(event.playerId);
    if (!slot) return;
    const startX = pawn.x;
    const startY = pawn.y;
    const destination = getPawnDisplayPosition(
      target,
      slot.playerIndex,
      slot.playerCount
    );
    const endX = destination.x;
    const endY = destination.y;
    const proxy = { t: 0 };

    await this.tween({
      targets: proxy,
      t: 1,
      duration: 340,
      ease: 'Sine.InOut',
      onUpdate: () => {
        pawn.x = Phaser.Math.Linear(startX, endX, proxy.t);
        pawn.y = Phaser.Math.Linear(startY, endY, proxy.t) - Math.sin(proxy.t * Math.PI) * 30;
        pawn.setDepth(getPawnDisplayDepth(pawn.y, slot.playerIndex));
      }
    });

    pawn
      .setPosition(endX, endY)
      .setDepth(getPawnDisplayDepth(endY, slot.playerIndex));
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

    const pawn = this.pawns.get(purchase.playerId);
    const displayColor = pawn?.getData('displayColor');
    if (typeof displayColor === 'number') {
      this.ensurePropertyFlag(purchase.propertyId, displayColor);
    }

    const flag = this.propertyFlags.get(purchase.propertyId);
    if (!flag) {
      await this.delay(150);
      return;
    }
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
    const layout = getBoardPresentationLayout(state.boardVersion);
    if (!layout) {
      this.clearBoardPresentation();
      this.hidePlayerPawns();
      return;
    }

    this.ensureBoardPresentation(layout);
    this.ensurePlayerPawns(state.players);

    state.players.forEach((player, playerIndex) => {
      const pawn = this.pawns.get(player.id);
      const node = layout.nodes[player.position];
      if (!pawn || !node) return;
      const position = getPawnDisplayPosition(
        node,
        playerIndex,
        state.players.length
      );
      pawn.setPosition(position.x, position.y);
      pawn.setDepth(getPawnDisplayDepth(position.y, playerIndex));
    });

    this.updateActivePlayerRing(state);

    for (const [propertyId, property] of Object.entries(state.properties)) {
      const badge = this.propertyBadges.get(propertyId);
      badge?.setText(`L${property.level}`);
      const owner = property.ownerId
        ? state.players.find((player) => player.id === property.ownerId)
        : undefined;
      if (!owner) {
        this.propertyFlags.get(propertyId)?.destroy();
        this.propertyFlags.delete(propertyId);
        continue;
      }
      this.ensurePropertyFlag(propertyId, toPhaserDisplayColor(owner.color));
    }

    notifyScenePresentationReady();
  }

  private hidePlayerPawns(): void {
    for (const pawn of this.pawns.values()) pawn.setVisible(false);
  }

  private updateActivePlayerRing(state: GameState): void {
    if (!this.activePlayerRing) return;
    const player = state.players[state.activePlayerIndex];
    if (!shouldShowActivePlayerRing(state.status, player)) {
      this.activePlayerRing.setVisible(false);
      return;
    }

    const pawn = this.pawns.get(player.id);
    if (!pawn) {
      this.activePlayerRing.setVisible(false);
      return;
    }

    this.activePlayerRing
      .setPosition(pawn.x, pawn.y + 13)
      .setDepth(pawn.depth - 0.1)
      .setStrokeStyle(4, toPhaserDisplayColor(player.color), 0.92)
      .setVisible(true);
  }

  private ensurePropertyFlag(propertyId: string, ownerColor: number): void {
    const existing = this.propertyFlags.get(propertyId);
    if (existing) {
      const cloth = existing.getAt(1) as Phaser.GameObjects.Rectangle | undefined;
      cloth?.setFillStyle(ownerColor);
      return;
    }

    const anchor = this.currentLayout?.propertyAnchors.find(
      (candidate) => candidate.propertyId === propertyId
    );
    if (!anchor) return;

    const pole = this.add.rectangle(0, -28, 4, 56, 0x2f454c);
    const cloth = this.add.rectangle(15, -46, 28, 18, ownerColor);
    const flag = this.add.container(
      anchor.x + anchor.flagOffset.x,
      anchor.y + anchor.flagOffset.y,
      [pole, cloth]
    );
    flag.setDepth(anchor.y + 50);
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
