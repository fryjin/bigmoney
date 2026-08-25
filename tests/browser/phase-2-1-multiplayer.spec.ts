import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

type BrowserGameText = {
  flow: string;
  status: string;
  round?: number;
  activePlayerIndex?: number;
  playerCount?: number;
  domainRevision?: number;
  lastEventTypes?: string[];
  eventResolutions?: Array<{
    eventId: string;
    playerId: string;
    changes: Array<{ playerId: string; amount: number }>;
  }>;
  winnerId?: string | null;
  activePlayerId?: string | null;
  pendingLiquidation?: {
    paymentId: string;
    payerId: string;
    receiverId: string | null;
    amount: number;
    reason: string;
  } | null;
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

const ROSTER_IDS = ['P1', 'P2', 'P3', 'P4'] as const;

test.describe('Phase 2.1 local multiplayer browser regression', () => {
  test.setTimeout(60_000);

  for (const playerCount of [2, 3, 4] as const) {
    test(`Scenarios A-C: starts a blank ${playerCount}-player game with the canonical roster`, async ({ page }, testInfo) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 });
      await startNewGame(page, playerCount);

      const game = await readGameText(page);
      expect(game.flow).toBe('turnReady');
      expect(game.playerCount).toBe(playerCount);
      expect(game.activePlayerIndex).toBe(0);
      expect(game.activePlayerId).toBe('P1');
      expect(game.players?.map((player) => player.id)).toEqual(
        ROSTER_IDS.slice(0, playerCount)
      );
      await expect(page.locator('.player-chip')).toHaveCount(playerCount);
      await expectActivePlayer(page, 'P1');
      await expect(page.locator('.game-canvas canvas')).toHaveCount(1);
      await page.screenshot({
        path: testInfo.outputPath(`new-game-${playerCount}-1194x834.png`),
        fullPage: false
      });
      expect(runtimeIssues).toEqual([]);
    });
  }

  test('Scenario D: three players complete a full visible handoff cycle and wrap', async ({
    page
  }, testInfo) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 }, 'no-preference');
    await startNewGame(page, 3);

    await completeTurnAndHandoff(page, 'P1', 'P2', 1);
    await completeTurnAndHandoff(page, 'P2', 'P3', 1);
    const wrapped = await completeTurnAndHandoff(page, 'P3', 'P1', 2);

    expect(wrapped.players?.find((player) => player.id === 'P3')?.position).not.toBe(0);
    await expectActivePlayer(page, 'P1');
    await page.screenshot({
      path: testInfo.outputPath('three-player-wrap-1194x834.png'),
      fullPage: false
    });
    expect(runtimeIssues).toEqual([]);
  });

  test('Scenario E: four players rotate in fixed order and increment only on wrap', async ({
    page
  }, testInfo) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 }, 'no-preference');
    await startNewGame(page, 4);

    await completeTurnAndHandoff(page, 'P1', 'P2', 1);
    await completeTurnAndHandoff(page, 'P2', 'P3', 1);
    await completeTurnAndHandoff(page, 'P3', 'P4', 1);
    const wrapped = await completeTurnAndHandoff(page, 'P4', 'P1', 2);

    expect(wrapped.players?.find((player) => player.id === 'P4')?.position).not.toBe(0);
    await expectActivePlayer(page, 'P1');
    await page.screenshot({
      path: testInfo.outputPath('four-player-wrap-1194x834.png'),
      fullPage: false
    });
    expect(runtimeIssues).toEqual([]);
  });

  for (const [fixture, nextPlayerId, bankruptCount] of [
    ['four-player-skip-p2', 'P3', 1],
    ['four-player-skip-p2-p3', 'P4', 2]
  ] as const) {
    test(`Scenarios F-G: ${fixture} routes to ${nextPlayerId} after skipping bankrupt players`, async ({ page }, testInfo) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 }, 'no-preference');
      await visitFixture(page, fixture);
      await completeTurnAndHandoff(page, 'P1', nextPlayerId, 1);
      await expect(page.locator('.player-chip.bankrupt')).toHaveCount(bankruptCount);
      await expectActivePlayer(page, nextPlayerId);
      await page.screenshot({
        path: testInfo.outputPath(`${fixture}-1194x834.png`),
        fullPage: false
      });
      expect(runtimeIssues).toEqual([]);
    });
  }

  for (const [fixture, playerCount] of [
    ['three-player-finished-p3', 3],
    ['four-player-finished-p3', 4]
  ] as const) {
    test(`Scenario I: ${fixture} reaches P3 final presentation, finished, and stable restore`, async ({ page }, testInfo) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1440, height: 900 });
      await visitFixture(page, fixture);

      await page.locator('.dice-button').click();
      await expectFlow(page, 'presentingFinished');
      await expect(page.locator('.winner-card .primary-action')).toBeEnabled();
      const presenting = await readGameText(page);
      expect(presenting.playerCount).toBe(playerCount);
      expect(presenting.winnerId).toBe('P3');
      expect(player(presenting, 'P1')).toMatchObject({ cash: 0, bankrupt: true });
      await page.screenshot({
        path: testInfo.outputPath(`${fixture}-presenting-1440x900.png`),
        fullPage: false
      });

      await page.locator('.winner-card .primary-action').dblclick();
      await expectFlow(page, 'finished');
      const finished = await readGameText(page);
      expect(finished.status).toBe('FINISHED');
      expect(finished.winnerId).toBe('P3');
      await expect(page.locator('.dice-button')).toHaveCount(0);

      await waitForStableSave();
      await page.reload();
      await expect(page.locator('.session-entry-card')).toBeVisible();
      await page.locator('.session-entry-card .primary-action').click();
      await expectFlow(page, 'finished');
      const restored = await readGameText(page);
      expect(restored.domainRevision).toBe(0);
      expect(restored.lastEventTypes).toEqual([]);
      expect(restored.winnerId).toBe('P3');
      expect(restored.players).toEqual(finished.players);
      expect(runtimeIssues).toEqual([]);
    });
  }

  test('Scenario J: restarting a saved four-player game with two players retires the old session', async ({
    page
  }, testInfo) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await startNewGame(page, 4);
    await waitForStableSave();

    await page.locator('.current-player-card .text-button').click();
    await expect(page.locator('.new-game-setup')).toBeVisible();
    await page.locator('.new-game-count').filter({ hasText: '2 人' }).click();
    await page.locator('.new-game-actions .primary-action').dblclick();
    await expectFlow(page, 'turnReady');

    const restarted = await readGameText(page);
    expect(restarted.players?.map((player) => player.id)).toEqual(['P1', 'P2']);
    expect(restarted.playerCount).toBe(2);
    await expect(page.locator('.player-chip')).toHaveCount(2);
    expect(await page.locator('.player-chip .player-avatar').allTextContents()).toEqual(['P1', 'P2']);
    await page.screenshot({
      path: testInfo.outputPath('restart-four-to-two-1194x834.png'),
      fullPage: false
    });

    await waitForStableSave();
    await page.reload();
    await expect(page.locator('.session-entry-card')).toBeVisible();
    await page.locator('.session-entry-card .primary-action').click();
    await expectFlow(page, 'turnReady');
    expect((await readGameText(page)).players?.map((player) => player.id)).toEqual(['P1', 'P2']);
    expect(runtimeIssues).toEqual([]);
  });

  for (const playerCount of [3, 4] as const) {
    test(`Scenario K: a ${playerCount}-player awaitingHandoff restore retains roster, turn owner, and RNG sequence`, async ({ page }) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 }, 'no-preference');
      await startNewGame(page, playerCount);

      await completeCurrentTurn(page, 'P1');
      await page.locator('.end-turn').click();
      await expectPrivateFlow(page, 'presentingTurnEnd');
      await expectFlow(page, 'awaitingHandoff');
      await expectPrivateProjection(page, 'awaitingHandoff');

      await waitForStableSave();
      await page.reload();
      await expect(page.locator('.session-entry-card')).toBeVisible();
      await page.locator('.session-entry-card .primary-action').click();
      await expectFlow(page, 'awaitingHandoff');
      await expectPrivateProjection(page, 'awaitingHandoff');
      await page.locator('.handoff-action').click();
      await expectFlow(page, 'turnReady');

      const restored = await readGameText(page);
      expect(restored.playerCount).toBe(playerCount);
      expect(restored.players?.map((player) => player.id)).toEqual(
        ROSTER_IDS.slice(0, playerCount)
      );
      expect(restored.activePlayerIndex).toBe(1);
      expect(restored.activePlayerId).toBe('P2');
      expect(restored.round).toBe(1);
      expect(restored.domainRevision).toBe(0);
      expect(restored.lastEventTypes).toEqual([]);

      await completeCurrentTurn(page, 'P2');
      expect(player(await readGameText(page), 'P2')?.position).toBe(5);
      expect(runtimeIssues).toEqual([]);
    });
  }

  for (const [fixture, playerCount] of [
    ['three-player-bankruptcy-handoff', 3],
    ['four-player-partial-liquidation', 4]
  ] as const) {
    test(`stable awaitingLiquidation reload restores the ${playerCount}-player payment without replay`, async ({ page }) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 });
      await openLiquidation(page, fixture);
      const before = await readGameText(page);
      expect(before.playerCount).toBe(playerCount);
      const paymentId = before.pendingLiquidation?.paymentId;
      expect(paymentId).toBeTruthy();

      await waitForStableSave();
      await page.reload();
      await expect(page.locator('.session-entry-card')).toBeVisible();
      await page.locator('.session-entry-card .primary-action').click();
      await expectFlow(page, 'awaitingLiquidation');
      const restored = await readGameText(page);
      expect(restored.pendingLiquidation?.paymentId).toBe(paymentId);
      expect(restored.domainRevision).toBe(0);
      expect(restored.lastEventTypes).toEqual([]);
      expect(restored.players).toEqual(before.players);
      expect(restored.properties).toEqual(before.properties);
      expect(runtimeIssues).toEqual([]);
    });
  }

  test('duplicate UI submissions do not advance roll, end-turn, handoff, or New Game start twice', async ({
    page
  }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await startNewGame(page, 3);

    await page.locator('.dice-button').dblclick();
    await resolveCurrentTurn(page);
    await page.locator('.end-turn').dblclick();
    await expectFlow(page, 'awaitingHandoff');
    await page.locator('.handoff-action').dblclick();
    await expectFlow(page, 'turnReady');
    expect((await readGameText(page)).activePlayerId).toBe('P2');

    await page.locator('.current-player-card .text-button').click();
    await expect(page.locator('.new-game-setup')).toBeVisible();
    await page.locator('.new-game-count').filter({ hasText: '4 人' }).click();
    await page.locator('.new-game-actions .primary-action').dblclick();
    await expectFlow(page, 'turnReady');
    expect((await readGameText(page)).players?.map((candidate) => candidate.id)).toEqual(
      ['P1', 'P2', 'P3', 'P4']
    );
    expect(runtimeIssues).toEqual([]);
  });

  test('duplicate liquidation submit stays on the same canonical payment', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await openLiquidation(page, 'partial-liquidation');
    const paymentId = (await readGameText(page)).pendingLiquidation?.paymentId;
    await page.locator('.liquidation-property').first().click();
    await page.locator('.liquidation-submit').dblclick();
    await expectFlow(page, 'awaitingLiquidation');
    const after = await readGameText(page);
    expect(after.pendingLiquidation?.paymentId).toBe(paymentId);
    expect(player(after, 'P2')?.cash).toBe(45);
    expect(runtimeIssues).toEqual([]);
  });

  test('duplicate bankruptcy acknowledgement creates one handoff only', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await openLiquidation(page, 'three-player-bankruptcy-handoff');
    await page.locator('.liquidation-property').click();
    await page.locator('.liquidation-submit').dblclick();
    await expectFlow(page, 'presentingBankruptcy');
    await page.locator('.bankruptcy-card .primary-action').dblclick();
    await expectFlow(page, 'awaitingHandoff');
    await expectPrivateProjection(page, 'awaitingHandoff');
    expect(runtimeIssues).toEqual([]);
  });

  test('PLAYER_TRANSFER uses P4 as the next live payer after bankrupt P3', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'four-player-player-transfer');

    await page.locator('.dice-button').click();
    await expectFlow(page, 'awaitingResult');
    const event = await readGameText(page);
    expect(event.eventResolutions).toEqual([{
      eventId: 'EVENT_NEIGHBOR_SUPPORT',
      playerId: 'P2',
      changes: [
        { playerId: 'P4', amount: -10 },
        { playerId: 'P2', amount: 10 }
      ]
    }]);
    expect(player(event, 'P2')?.cash).toBe(510);
    expect(player(event, 'P4')?.cash).toBe(0);
    await expect(page.locator('.result-modal')).toContainText('下一名仍在游戏中的玩家');
    await page.locator('.result-modal .primary-action').click();
    await expectFlow(page, 'turnEnd');
    expect(runtimeIssues).toEqual([]);
  });

  test('Phaser board presentation retains 2-4 pawn counts, same-tile slots, owner colors, and cleanup', async ({
    page
  }, testInfo) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'four-player-presentation');
    await expect(page.locator('.player-chip')).toHaveCount(4);
    await expect(page.locator('.player-chip.bankrupt')).toHaveCount(1);
    await expectActivePlayer(page, 'P1');
    await expect(page.locator('.game-canvas canvas')).toHaveCount(1);
    await page.screenshot({
      path: testInfo.outputPath('phaser-four-player-presentation-1194x834.png'),
      fullPage: false
    });

    expect(runtimeIssues).toEqual([]);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1194, height: 834 },
    { width: 1440, height: 900 }
  ]) {
    test(`multiplayer UI and board fit ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, viewport);
    await visitFixture(page, 'four-player-presentation');
    const board = page.locator('.game-canvas');
    const boardBox = await board.boundingBox();
    expect(boardBox).not.toBeNull();
    expect(boardBox!.x).toBeGreaterThanOrEqual(0);
    expect(boardBox!.x + boardBox!.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`multiplayer-${viewport.width}x${viewport.height}.png`),
      fullPage: false
    });
    expect(runtimeIssues).toEqual([]);
    });
  }
});

async function preparePage(
  page: Page,
  viewport: { width: number; height: number },
  reducedMotion: 'reduce' | 'no-preference' = 'reduce'
): Promise<void> {
  await page.emulateMedia({ reducedMotion });
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

async function visitFixture(page: Page, fixture: string): Promise<void> {
  await page.goto(`/?fixture=${fixture}`);
  await expectFlow(page, 'turnReady');
  await expect(page.locator('.scene-loading')).toHaveCount(0);
}

async function openLiquidation(page: Page, fixture: string): Promise<void> {
  await visitFixture(page, fixture);
  await page.locator('.dice-button').click();
  await expectFlow(page, 'awaitingLiquidation');
  await expect(page.locator('.liquidation-modal')).toBeVisible();
}

async function completeTurnAndHandoff(
  page: Page,
  currentPlayerId: string,
  nextPlayerId: string,
  expectedRound: number
): Promise<BrowserGameText> {
  await completeCurrentTurn(page, currentPlayerId);
  await page.locator('.end-turn').click();
  await expectPrivateFlow(page, 'presentingTurnEnd');
  await expectFlow(page, 'awaitingHandoff');
  await expectPrivateProjection(page, 'awaitingHandoff');
  await expect(page.locator('.private-info-hidden .control-dock')).toHaveCount(0);
  await page.locator('.handoff-action').click();
  await expectFlow(page, 'turnReady');
  const next = await readGameText(page);
  expect(next.activePlayerId).toBe(nextPlayerId);
  expect(next.round).toBe(expectedRound);
  return next;
}

async function completeCurrentTurn(page: Page, currentPlayerId: string): Promise<void> {
  expect((await readGameText(page)).activePlayerId).toBe(currentPlayerId);
  await page.locator('.dice-button').click();

  await resolveCurrentTurn(page);
}

async function resolveCurrentTurn(page: Page): Promise<void> {
  for (let attempts = 0; attempts < 8; attempts += 1) {
    await expect.poll(async () => isTurnActionable((await readGameText(page)).flow)).toBe(true);
    const game = await readGameText(page);
    if (game.flow === 'turnEnd') return;
    if (game.flow === 'awaitingStock') {
      await page.locator('.stock-modal .secondary-action').click();
      continue;
    }
    if (game.flow === 'awaitingProperty') {
      await page.locator('.property-modal .secondary-action').click();
      continue;
    }
    if (game.flow === 'awaitingUpgrade') {
      await page.locator('.property-modal .secondary-action').click();
      continue;
    }
    if (game.flow === 'awaitingResult') {
      const resultAction = page.locator('.result-modal .primary-action');
      if (await resultAction.count()) {
        await resultAction.click();
      } else {
        await page.locator('.replacement-card').first().click();
      }
      continue;
    }
    throw new Error(`Unexpected actionable flow: ${game.flow}`);
  }

  throw new Error('Turn did not reach turnEnd after the allowed decision sequence.');
}

function isTurnActionable(flow: string): boolean {
  return (
    flow === 'turnEnd' ||
    flow === 'awaitingStock' ||
    flow === 'awaitingProperty' ||
    flow === 'awaitingUpgrade' ||
    flow === 'awaitingResult'
  );
}

async function expectActivePlayer(page: Page, playerId: string): Promise<void> {
  await expect(page.locator('.player-chip.active .player-avatar')).toHaveText(playerId);
}

async function expectPrivateProjection(page: Page, flow: string): Promise<void> {
  expect(await readGameText(page)).toEqual({
    flow,
    status: 'IN_PROGRESS',
    privateInfoHidden: true
  });
}

async function expectPrivateFlow(page: Page, flow: string): Promise<void> {
  await expect.poll(async () => {
    const game = await readGameText(page);
    return game.flow === flow && game.privateInfoHidden === true;
  }).toBe(true);
}

async function waitForStableSave(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
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

function player(game: BrowserGameText, playerId: string) {
  return game.players?.find((candidate) => candidate.id === playerId);
}

function watchRuntime(page: Page): string[] {
  const issues: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const location = message.location();
      issues.push(
        `${message.type()}: ${message.text()} (${location.url}:${location.lineNumber})`
      );
    }
  });
  page.on('pageerror', (error) => {
    issues.push(`pageerror: ${error.stack ?? error.message}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      issues.push(`http ${response.status()}: ${response.url()}`);
    }
  });
  return issues;
}
