import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

type BrowserGameText = {
  flow: string;
  status: string;
  boardVersion?: string;
  tileCount?: number;
  round?: number;
  activePlayerId?: string | null;
  activePlayerPosition?: number | null;
  currentTileId?: string | null;
  currentTileType?: string | null;
  currentTileName?: string | null;
  currentTileReservedKind?: string | null;
  pendingInteractionType?: string | null;
  pendingMarketId?: string | null;
  pendingEventId?: string | null;
  pendingCardId?: string | null;
  pendingPropertyId?: string | null;
  players?: Array<{
    id: string;
    cash: number;
    position: number;
    bankrupt: boolean;
  }>;
  properties?: Array<{
    id: string;
    ownerId: string | null;
    level: number;
  }>;
  privateInfoHidden?: boolean;
};

const FULL_MAP_VERSION = 'full-map-36-v1';
const ROSTER_IDS = ['P1', 'P2', 'P3', 'P4'] as const;

test.describe('Phase 3.0 full-map production browser acceptance', () => {
  test.setTimeout(60_000);

  for (const playerCount of [2, 3, 4] as const) {
    test(`New Game ${playerCount} players creates the formal 36-tile production state`, async ({ page }) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 });
      await startNewGame(page, playerCount);

      const game = await readGameText(page);
      expect(game).toMatchObject({
        flow: 'turnReady',
        status: 'IN_PROGRESS',
        boardVersion: FULL_MAP_VERSION,
        tileCount: 36,
        activePlayerId: 'P1',
        activePlayerPosition: 0
      });
      expect(game.players?.map((player) => player.id)).toEqual(ROSTER_IDS.slice(0, playerCount));
      expect(game.players?.every((player) => player.position === 0 && player.cash === 500)).toBe(true);
      expect(game.properties).toHaveLength(20);
      expect(game.properties?.every((property) => property.ownerId === null && property.level === 0)).toBe(true);
      await expect(page.locator('.game-canvas canvas')).toHaveCount(1);
      expect(runtimeIssues).toEqual([]);
    });
  }

  test('HUD renders canonical START numbering without 0 or 37', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'property-purchase');
    await expect(page.locator('.current-player-card')).toContainText('第 1 / 36 格 · 出发广场');
    await expect(page.locator('.current-player-card')).not.toContainText('第 0 格');
    await expect(page.locator('.current-player-card')).not.toContainText('第 37 格');
    expect(runtimeIssues).toEqual([]);
  });

  test('HUD renders canonical intermediate numbering', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'reserved-jail');
    await page.locator('.dice-button').click();
    await expectFlow(page, 'turnEnd');
    await expect(page.locator('.current-player-card')).toContainText('第 10 / 36 格 · 城市拘留所');
    expect(runtimeIssues).toEqual([]);
  });

  test('a normal D6 roll moves through the formal full-map flow', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'property-purchase');

    await page.locator('.dice-button').click();
    await expectFlow(page, 'awaitingProperty');
    const moved = await readGameText(page);
    expect(moved.activePlayerPosition).toBe(1);
    expect(moved.currentTileId).toBe('PROPERTY_HARBOR_01');
    expect(moved.currentTileType).toBe('PROPERTY');
    expect(moved.pendingPropertyId).toBe('HARBOR_01');
    expect(runtimeIssues).toEqual([]);
  });

  test('FINISH itself grants no lap reward', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'finish-no-lap');

    await page.locator('.dice-button').click();
    await expectFlow(page, 'turnEnd');
    const finish = await readGameText(page);
    expect(player(finish, 'P1')).toMatchObject({ cash: 500, position: 35 });
    expect(finish.currentTileId).toBe('FINISH');
    await expect(page.locator('.current-player-card')).toContainText('第 36 / 36 格 · 城市终点');
    expect(runtimeIssues).toEqual([]);
  });

  test('35 to 0 grants exactly one +80 reward', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'lap-wrap');
    await page.locator('.dice-button').click();
    await expectFlow(page, 'turnEnd');
    const wrapped = await readGameText(page);
    expect(player(wrapped, 'P1')).toMatchObject({ cash: 580, position: 0 });
    expect(wrapped.currentTileId).toBe('START');
    expect(runtimeIssues).toEqual([]);
  });

  test('multi-step wrap crosses 35 then 0 and grants exactly one +80 reward', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'multi-step-wrap');
    await page.locator('.dice-button').click();
    await expectFlow(page, 'turnEnd');
    const multiStep = await readGameText(page);
    expect(player(multiStep, 'P1')).toMatchObject({ cash: 580, position: 0 });
    expect(runtimeIssues).toEqual([]);
  });

  for (const [fixture, index, tileId, reservedKind, name] of [
    ['reserved-jail', 9, 'RESERVED_JAIL', 'JAIL', '城市拘留所'],
    ['reserved-facility-01', 14, 'RESERVED_FACILITY_01', 'FACILITY', '城市服务中心'],
    ['reserved-project', 18, 'RESERVED_PROJECT', 'PROJECT', '合作开发区'],
    ['reserved-facility-02', 25, 'RESERVED_FACILITY_02', 'FACILITY', '中央枢纽'],
    ['reserved-minigame', 27, 'RESERVED_MINIGAME', 'MINIGAME', '城市挑战场']
  ] as const) {
    test(`RESERVED index ${index} is a no-op destination through the UI`, async ({ page }) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 });
      await visitFixture(page, fixture);

      await page.locator('.dice-button').click();
      await expectFlow(page, 'turnEnd');
      const game = await readGameText(page);
      expect(game).toMatchObject({
        activePlayerPosition: index,
        currentTileId: tileId,
        currentTileType: 'RESERVED',
        currentTileName: name,
        currentTileReservedKind: reservedKind,
        pendingInteractionType: null
      });
      expect(player(game, 'P1')?.cash).toBe(500);
      await expect(page.locator('.current-player-card')).toContainText(
        `第 ${index + 1} / 36 格 · ${name}`
      );
      await expect(page.locator('.current-player-card')).toContainText('暂未开放');
      await expect(page.locator('.end-turn')).toBeVisible();
      expect(runtimeIssues).toEqual([]);
    });
  }

  test('formal low property supports purchase', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'property-purchase');
    await page.locator('.dice-button').click();
    await expectFlow(page, 'awaitingProperty');
    await page.locator('.property-modal .primary-action').click();
    await expectFlow(page, 'turnEnd');
    const purchased = await readGameText(page);
    expect(property(purchased, 'HARBOR_01')).toEqual({ id: 'HARBOR_01', ownerId: 'P1', level: 0 });
    expect(player(purchased, 'P1')?.cash).toBe(450);
    expect(runtimeIssues).toEqual([]);
  });

  test('formal medium property supports an owner upgrade', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'property-upgrade');
    await page.locator('.dice-button').click();
    await expectFlow(page, 'awaitingUpgrade');
    await page.locator('.property-modal .primary-action').click();
    await expectFlow(page, 'turnEnd');
    expect(property(await readGameText(page), 'METRO_03')).toMatchObject({ ownerId: 'P1', level: 1 });
    expect(runtimeIssues).toEqual([]);
  });

  test('formal high property charges rent through the production flow', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'property-rent');
    await page.locator('.dice-button').click();
    await expectFlow(page, 'turnEnd');
    const rented = await readGameText(page);
    expect(property(rented, 'SKYLINE_05')).toMatchObject({ ownerId: 'P1', level: 2 });
    expect(player(rented, 'P1')?.cash).toBeGreaterThan(500);
    expect(player(rented, 'P2')?.cash).toBeLessThan(500);
    expect(runtimeIssues).toEqual([]);
  });

  for (const fixture of ['stock-entry-01', 'stock-entry-02'] as const) {
    test(`${fixture} enters the shared MARKET_01 through the normal flow`, async ({ page }) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 });
      await visitFixture(page, fixture);

      await page.locator('.dice-button').click();
      await expectFlow(page, 'awaitingStock');
      expect(await readGameText(page)).toMatchObject({
        pendingInteractionType: 'STOCK_MARKET',
        pendingMarketId: 'MARKET_01'
      });
      await page.locator('.stock-modal .secondary-action').click();
      await expectFlow(page, 'turnEnd');
      expect(runtimeIssues).toEqual([]);
    });
  }

  for (const fixture of ['card-entry-01', 'card-entry-02', 'card-entry-03'] as const) {
    test(`${fixture} uses the formal shared card pool`, async ({ page }) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 });
      await visitFixture(page, fixture);

      await page.locator('.dice-button').click();
      await expectFlow(page, 'awaitingResult');
      const game = await readGameText(page);
      expect(game.pendingInteractionType).toBe('CARD_DRAW');
      expect(game.pendingCardId).toBeTruthy();
      await page.locator('.result-modal .primary-action').click();
      await expectFlow(page, 'turnEnd');
      expect(runtimeIssues).toEqual([]);
    });
  }

  for (const fixture of ['event-entry-01', 'event-entry-02', 'event-entry-03', 'event-entry-04'] as const) {
    test(`${fixture} resolves through the shared formal event pool`, async ({ page }) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 });
      await visitFixture(page, fixture);

      await page.locator('.dice-button').click();
      await expectFlow(page, 'awaitingResult');
      expect(await readGameText(page)).toMatchObject({
        pendingInteractionType: 'EVENT_RESULT',
        pendingEventId: 'EVENT_CITY_REWARD'
      });
      await page.locator('.result-modal .primary-action').click();
      await expectFlow(page, 'turnEnd');
      expect(runtimeIssues).toEqual([]);
    });
  }

  test('a v4 full-map save restores canonical state, RNG continuation, and the 36-tile board', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await startNewGame(page, 3);

    await page.locator('.dice-button').click();
    await expectFlow(page, 'awaitingProperty');
    await page.locator('.property-modal .secondary-action').click();
    await expectFlow(page, 'turnEnd');
    await page.locator('.end-turn').click();
    await expectFlow(page, 'awaitingHandoff');
    await page.locator('.handoff-action').click();
    await expectFlow(page, 'turnReady');
    const beforeReload = await readGameText(page);
    await waitForStableSave(page, 'turnReady');

    await page.reload();
    await expect(page.locator('.session-entry-card')).toBeVisible();
    await page.locator('.session-entry-card .primary-action').click();
    await expectFlow(page, 'turnReady');
    await expect(page.locator('.scene-loading')).toHaveCount(0);
    const restored = await readGameText(page);
    expect(restored).toMatchObject({
      boardVersion: FULL_MAP_VERSION,
      tileCount: 36,
      activePlayerId: beforeReload.activePlayerId,
      activePlayerPosition: beforeReload.activePlayerPosition,
      round: beforeReload.round
    });
    expect(restored.players).toEqual(beforeReload.players);
    expect(restored.properties).toEqual(beforeReload.properties);
    await page.locator('.dice-button').click();
    await expectFlow(page, 'awaitingProperty');
    expect((await readGameText(page)).activePlayerPosition).toBe(5);
    expect(runtimeIssues).toEqual([]);
  });

  test('scene presentation remains ready across fixture navigation and session replacement', async ({ page }, testInfo) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });

    await visitFixture(page, 'reserved-jail');
    await visitFixture(page, 'reserved-project');
    await expect(page.locator('.game-canvas canvas')).toHaveCount(1);
    await waitForStableSave(page, 'turnReady');

    await restartSavedGameWithPlayerCount(page, 4);
    await waitForStableSave(page, 'turnReady');

    await restartActiveGameWithPlayerCount(page, 2);
    const restarted = await readGameText(page);
    expect(restarted.players?.map((candidate) => candidate.id)).toEqual(['P1', 'P2']);
    expect(restarted.properties).toHaveLength(20);
    await expect(page.locator('.player-chip')).toHaveCount(2);
    await page.screenshot({
      path: testInfo.outputPath('restart-four-to-two-1194x834.png'),
      fullPage: false
    });
    expect(runtimeIssues).toEqual([]);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1194, height: 834 },
    { width: 1440, height: 900 }
  ]) {
    test(`full-map presentation remains usable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, viewport);
      await visitFixture(page, 'four-player-presentation');

      const board = page.locator('.game-canvas');
      const box = await board.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      await expect(page.locator('.game-canvas canvas')).toHaveCount(1);
      await expect(page.locator('.player-chip')).toHaveCount(4);
      const game = await readGameText(page);
      expect(player(game, 'P3')?.position).toBe(3);
      expect(player(game, 'P4')?.position).toBe(3);
      expect(property(game, 'HARBOR_01')).toEqual({
        id: 'HARBOR_01',
        ownerId: 'P3',
        level: 1
      });
      expect(property(game, 'METRO_03')).toEqual({
        id: 'METRO_03',
        ownerId: 'P4',
        level: 3
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`full-map-${viewport.width}x${viewport.height}.png`),
        fullPage: false
      });
      expect(runtimeIssues).toEqual([]);
    });
  }
});

async function preparePage(
  page: Page,
  viewport: { width: number; height: number }
): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(viewport);
}

async function startNewGame(page: Page, playerCount: 2 | 3 | 4): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.new-game-setup')).toBeVisible();
  await page.locator('.new-game-count').filter({ hasText: `${playerCount} 人` }).click();
  await page.locator('.new-game-actions .primary-action').click();
  await expectFlow(page, 'turnReady');
  await expect(page.locator('.scene-loading')).toHaveCount(0);
}

async function restartSavedGameWithPlayerCount(page: Page, playerCount: 2 | 3 | 4): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.session-entry-card')).toBeVisible();
  await page.locator('.session-entry-card .secondary-action').click();
  await selectPlayerCountAndStart(page, playerCount);
}

async function restartActiveGameWithPlayerCount(page: Page, playerCount: 2 | 3 | 4): Promise<void> {
  await page.locator('.current-player-card .text-button').click();
  await selectPlayerCountAndStart(page, playerCount);
}

async function selectPlayerCountAndStart(page: Page, playerCount: 2 | 3 | 4): Promise<void> {
  await expect(page.locator('.new-game-setup')).toBeVisible();
  await page.locator('.new-game-count').filter({ hasText: `${playerCount} 人` }).click();
  await page.locator('.new-game-actions .primary-action').click();
  await expectFlow(page, 'turnReady');
  await expect(page.locator('.scene-loading')).toHaveCount(0);
}

async function visitFixture(page: Page, fixture: string): Promise<void> {
  await page.goto(`/?fixture=${fixture}`);
  await expectFlow(page, 'turnReady');
  await expect(page.locator('.scene-loading')).toHaveCount(0);
}

async function readGameText(page: Page): Promise<BrowserGameText> {
  await page.waitForFunction(
    () => typeof window.render_game_to_text === 'function'
  );
  return page.evaluate(() => {
    const renderGameToText = window.render_game_to_text;
    if (typeof renderGameToText !== 'function') {
      throw new Error('browser-test state projection is unavailable.');
    }
    const text = renderGameToText();
    return text === 'NO_ACTIVE_SESSION'
      ? { flow: 'noActiveSession', status: 'UNAVAILABLE' }
      : JSON.parse(text) as BrowserGameText;
  });
}

async function expectFlow(page: Page, flow: string): Promise<void> {
  await expect.poll(async () => (await readGameText(page)).flow).toBe(flow);
}

async function waitForStableSave(page: Page, flow: string): Promise<void> {
  await page.waitForFunction(async (expectedFlow) => {
    const database = await new Promise<IDBDatabase | null>((resolve) => {
      const request = indexedDB.open('bigmoney-local-v1');
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
    });
    if (!database) return false;
    const record = await new Promise<{ payload?: { flow?: string } } | undefined>((resolve) => {
      const transaction = database.transaction('snapshots', 'readonly');
      const request = transaction.objectStore('snapshots').get('local-game-current');
      request.onerror = () => resolve(undefined);
      request.onsuccess = () => resolve(request.result as { payload?: { flow?: string } } | undefined);
    });
    database.close();
    return record?.payload?.flow === expectedFlow;
  }, flow);
}

function player(game: BrowserGameText, playerId: string) {
  return game.players?.find((candidate) => candidate.id === playerId);
}

function property(game: BrowserGameText, propertyId: string) {
  return game.properties?.find((candidate) => candidate.id === propertyId);
}

function watchRuntime(page: Page): string[] {
  const issues: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const location = message.location();
      issues.push(`${message.type()}: ${message.text()} (${location.url}:${location.lineNumber})`);
    }
  });
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) issues.push(`http ${response.status()}: ${response.url()}`);
  });
  return issues;
}
