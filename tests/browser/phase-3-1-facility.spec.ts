import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

type BrowserGameText = {
  flow: string;
  status: string;
  winnerId?: string | null;
  activePlayerId?: string | null;
  activePlayerPosition?: number | null;
  currentTileId?: string | null;
  currentTileType?: string | null;
  currentTileName?: string | null;
  currentTileReservedKind?: string | null;
  pendingInteractionType?: string | null;
  pendingLiquidation?: {
    paymentId: string;
    payerId: string;
    receiverId: string | null;
    amount: number;
    reason: string;
    tileId: string | null;
  } | null;
  completedPayments?: Array<{
    paymentId: string;
    payerId: string;
    receiverId: string | null;
    amount: number;
    reason: string;
    tileId: string | null;
  }>;
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

test.describe('Phase 3.1 public facility production browser acceptance', () => {
  test('index 14 charges its canonical public fee through the destination cue', async ({ page }, testInfo) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'facility-direct-14');

    await page.locator('.dice-button').click();
    await expectFlow(page, 'turnEnd');
    const paid = await readGameText(page);
    expect(paid).toMatchObject({
      activePlayerPosition: 14,
      currentTileId: 'RESERVED_FACILITY_01',
      currentTileType: 'FACILITY',
      currentTileName: '城市服务中心',
      pendingInteractionType: null,
      pendingLiquidation: null
    });
    expect(player(paid, 'P1')).toMatchObject({ cash: 70, bankrupt: false });
    expect(completedPublicFee(paid)).toMatchObject({
      payerId: 'P1',
      receiverId: null,
      amount: 30,
      tileId: 'RESERVED_FACILITY_01'
    });
    await expect(page.locator('.current-player-card')).toContainText('第 15 / 36 格 · 城市服务中心');
    await expect(page.locator('.current-player-card')).toContainText('公共设施费用 · 300万元');
    await expect(page.locator('.status-pill')).toContainText('城市服务中心 已支付300万元公共设施费用');
    await expect(page.locator('.property-modal')).toHaveCount(0);
    await expect(page.locator('.liquidation-modal')).toHaveCount(0);
    await expect(page.locator('.current-player-card')).not.toContainText('暂未开放');
    await expect(page.locator('.end-turn')).toBeVisible();
    await expect(page.locator('.scene-loading')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('facility-direct-14-1194x834.png'), fullPage: false });

    await page.locator('.end-turn').click();
    await expectFlow(page, 'awaitingHandoff');
    expect(runtimeIssues).toEqual([]);
  });

  test('index 25 charges its second canonical public fee through production runtime', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'facility-direct-25');

    await page.locator('.dice-button').click();
    await expectFlow(page, 'turnEnd');
    const paid = await readGameText(page);
    expect(paid).toMatchObject({
      activePlayerPosition: 25,
      currentTileId: 'RESERVED_FACILITY_02',
      currentTileType: 'FACILITY',
      currentTileName: '中央枢纽'
    });
    expect(player(paid, 'P1')).toMatchObject({ cash: 50, bankrupt: false });
    expect(completedPublicFee(paid)).toMatchObject({ amount: 50, receiverId: null, tileId: 'RESERVED_FACILITY_02' });
    await expect(page.locator('.current-player-card')).toContainText('第 26 / 36 格 · 中央枢纽');
    await expect(page.locator('.current-player-card')).toContainText('公共设施费用 · 500万元');
    await expect(page.locator('.current-player-card')).not.toContainText('暂未开放');
    expect(runtimeIssues).toEqual([]);
  });

  test('passing through index 14 does not charge a public fee', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'facility-pass-through-14');

    await page.locator('.dice-button').click();
    await expectFlow(page, 'awaitingProperty');
    const moved = await readGameText(page);
    expect(moved).toMatchObject({
      activePlayerPosition: 15,
      currentTileType: 'PROPERTY',
      pendingInteractionType: 'PROPERTY_PURCHASE',
      pendingLiquidation: null
    });
    expect(player(moved, 'P1')?.cash).toBe(100);
    expect(moved.completedPayments).toEqual([]);
    await expect(page.locator('.status-pill')).not.toContainText('公共设施费用');
    await expect(page.locator('.liquidation-modal')).toHaveCount(0);
    expect(runtimeIssues).toEqual([]);
  });

  test('cash exactly equal to the index 14 fee reaches zero without bankruptcy', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await visitFixture(page, 'facility-exact-fee-14');

    await page.locator('.dice-button').click();
    await expectFlow(page, 'turnEnd');
    const paid = await readGameText(page);
    expect(player(paid, 'P1')).toMatchObject({ cash: 0, bankrupt: false });
    expect(paid.pendingLiquidation).toBeNull();
    await expect(page.locator('.liquidation-modal')).toHaveCount(0);
    await expect(page.locator('.end-turn')).toBeVisible();
    expect(runtimeIssues).toEqual([]);
  });

  test('index 14 liquidates a property through the shared public-fee payment path', async ({ page }, testInfo) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await openLiquidation(page, 'facility-liquidation-14');

    const pending = await readGameText(page);
    expect(pending.pendingLiquidation).toMatchObject({
      payerId: 'P1',
      receiverId: null,
      amount: 30,
      reason: 'PUBLIC_FEE',
      tileId: 'RESERVED_FACILITY_01'
    });
    await expect(page.locator('.liquidation-modal')).toContainText('公共设施费用 · 城市服务中心');
    await expect(page.locator('.liquidation-modal')).toContainText('应付金额');
    await expect(page.locator('.liquidation-modal')).toContainText('300万元');
    await expect(page.locator('.liquidation-modal')).not.toContainText('地产租金');
    await expect(page.locator('.liquidation-modal')).not.toContainText('城市费用');
    await page.screenshot({ path: testInfo.outputPath('facility-liquidation-14-1194x834.png'), fullPage: false });

    const paymentId = pending.pendingLiquidation?.paymentId;
    await page.locator('.liquidation-property').click();
    await page.locator('.liquidation-submit').dblclick();
    await expectFlow(page, 'turnEnd');
    const paid = await readGameText(page);
    expect(paid.pendingLiquidation).toBeNull();
    expect(property(paid, 'HARBOR_03')).toEqual({ id: 'HARBOR_03', ownerId: null, level: 0 });
    expect(player(paid, 'P1')?.cash).toBe(20);
    expect(completedPublicFee(paid)).toMatchObject({ paymentId, amount: 30, receiverId: null });
    await expect(page.locator('.end-turn')).toBeVisible();
    expect(runtimeIssues).toEqual([]);
  });

  test('public-fee liquidation restores the same canonical debt and completes without replay', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await openLiquidation(page, 'facility-liquidation-14');
    const beforeReload = await readGameText(page);
    const payment = beforeReload.pendingLiquidation;
    expect(payment).toMatchObject({ receiverId: null, amount: 30, reason: 'PUBLIC_FEE', tileId: 'RESERVED_FACILITY_01' });
    await waitForStableSave(page, 'awaitingLiquidation');

    await page.reload();
    await expect(page.locator('.session-entry-card')).toBeVisible();
    await page.locator('.session-entry-card .primary-action').click();
    await expectFlow(page, 'awaitingLiquidation');
    await expect(page.locator('.scene-loading')).toHaveCount(0);

    const restored = await readGameText(page);
    expect(restored.pendingLiquidation).toEqual(payment);
    expect(restored.completedPayments).toEqual([]);
    expect(restored.players).toEqual(beforeReload.players);
    expect(restored.properties).toEqual(beforeReload.properties);
    await expect(page.locator('.liquidation-modal')).toContainText('公共设施费用 · 城市服务中心');
    await page.locator('.liquidation-property').click();
    await page.locator('.liquidation-submit').dblclick();
    await expectFlow(page, 'turnEnd');
    expect(completedPublicFee(await readGameText(page))).toMatchObject({ paymentId: payment?.paymentId, amount: 30 });
    expect(runtimeIssues).toEqual([]);
  });

  test('an insolvent facility payer is bankrupted then handed to the next surviving player', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await openLiquidation(page, 'facility-bankruptcy-handoff-14');

    await page.locator('.liquidation-property').click();
    await page.locator('.liquidation-submit').dblclick();
    await expectFlow(page, 'presentingBankruptcy');
    const bankrupt = await readGameText(page);
    expect(player(bankrupt, 'P2')).toMatchObject({ cash: 0, bankrupt: true });
    expect(property(bankrupt, 'HARBOR_01')).toEqual({ id: 'HARBOR_01', ownerId: null, level: 0 });
    await expect(page.locator('.bankruptcy-card')).toBeVisible();

    await page.locator('.bankruptcy-card .primary-action').dblclick();
    await expectFlow(page, 'awaitingHandoff');
    expect(await readGameText(page)).toEqual({ flow: 'awaitingHandoff', status: 'IN_PROGRESS', privateInfoHidden: true });
    await page.locator('.handoff-action').click();
    await expectFlow(page, 'turnReady');
    expect((await readGameText(page)).activePlayerId).toBe('P3');
    expect(runtimeIssues).toEqual([]);
  });

  test('facility bankruptcy finishes a two-player game with the correct winner', async ({ page }) => {
    const runtimeIssues = watchRuntime(page);
    await preparePage(page, { width: 1194, height: 834 });
    await openLiquidation(page, 'facility-bankruptcy-finished-14');

    await page.locator('.liquidation-property').click();
    await page.locator('.liquidation-submit').dblclick();
    await expectFlow(page, 'presentingFinished');
    const presenting = await readGameText(page);
    expect(presenting).toMatchObject({ status: 'FINISHED', winnerId: 'P1' });
    expect(player(presenting, 'P2')).toMatchObject({ cash: 0, bankrupt: true });
    await page.locator('.winner-card .primary-action').dblclick();
    await expectFlow(page, 'finished');
    expect(runtimeIssues).toEqual([]);
  });

  for (const [fixture, position, name, feeText] of [
    ['facility-stable-14', 14, '城市服务中心', '300万元'],
    ['facility-stable-25', 25, '中央枢纽', '500万元']
  ] as const) {
    test(`stable v4 position ${position} restores without retroactive facility collection`, async ({ page }) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 });
      await visitFixture(page, fixture);
      const beforeReload = await readGameText(page);
      expect(beforeReload).toMatchObject({ flow: 'turnReady', activePlayerPosition: position, currentTileType: 'FACILITY' });
      expect(player(beforeReload, 'P1')?.cash).toBe(100);
      expect(beforeReload.completedPayments).toEqual([]);
      await expect(page.locator('.current-player-card')).toContainText(`第 ${position + 1} / 36 格 · ${name}`);
      await expect(page.locator('.current-player-card')).toContainText(`公共设施费用 · ${feeText}`);
      await waitForStableSave(page, 'turnReady');

      await page.reload();
      await expect(page.locator('.session-entry-card')).toBeVisible();
      await page.locator('.session-entry-card .primary-action').click();
      await expectFlow(page, 'turnReady');
      const restored = await readGameText(page);
      expect(restored.players).toEqual(beforeReload.players);
      expect(restored.completedPayments).toEqual([]);
      expect(restored.pendingLiquidation).toBeNull();
      await expect(page.locator('.status-pill')).not.toContainText('已支付');
      expect(runtimeIssues).toEqual([]);
    });
  }

  for (const [fixture, index, tileId, reservedKind, name] of [
    ['reserved-jail', 9, 'RESERVED_JAIL', 'JAIL', '城市拘留所'],
    ['reserved-project', 18, 'RESERVED_PROJECT', 'PROJECT', '合作开发区'],
    ['reserved-minigame', 27, 'RESERVED_MINIGAME', 'MINIGAME', '城市挑战场']
  ] as const) {
    test(`RESERVED index ${index} remains an unavailable no-op`, async ({ page }, testInfo) => {
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
        currentTileReservedKind: reservedKind,
        pendingInteractionType: null
      });
      expect(game.completedPayments).toEqual([]);
      await expect(page.locator('.current-player-card')).toContainText(`第 ${index + 1} / 36 格 · ${name}`);
      await expect(page.locator('.current-player-card')).toContainText('暂未开放');
      await expect(page.locator('.property-modal')).toHaveCount(0);
      await expect(page.locator('.liquidation-modal')).toHaveCount(0);
      if (index === 9) {
        await page.screenshot({ path: testInfo.outputPath('reserved-jail-1194x834.png'), fullPage: false });
      }
      expect(runtimeIssues).toEqual([]);
    });
  }

  for (const [fixture, playerCount] of [
    ['facility-direct-14', 2],
    ['facility-direct-14-3p', 3],
    ['facility-direct-14-4p', 4]
  ] as const) {
    test(`${playerCount}-player local roster completes a facility landing and normal handoff`, async ({ page }) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, { width: 1194, height: 834 });
      await visitFixture(page, fixture);
      await page.locator('.dice-button').click();
      await expectFlow(page, 'turnEnd');
      const paid = await readGameText(page);
      expect(paid.players).toHaveLength(playerCount);
      expect(paid.currentTileType).toBe('FACILITY');
      expect(player(paid, 'P1')?.cash).toBe(70);
      await page.locator('.end-turn').click();
      await expectFlow(page, 'awaitingHandoff');
      await page.locator('.handoff-action').click();
      await expectFlow(page, 'turnReady');
      expect((await readGameText(page)).activePlayerId).toBe('P2');
      expect(runtimeIssues).toEqual([]);
    });
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1194, height: 834 },
    { width: 1440, height: 900 }
  ]) {
    test(`facility liquidation remains usable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      const runtimeIssues = watchRuntime(page);
      await preparePage(page, viewport);
      await openLiquidation(page, 'facility-liquidation-14');

      const modal = page.locator('.liquidation-modal');
      const submit = page.locator('.liquidation-submit');
      const modalBox = await modal.boundingBox();
      const submitBox = await submit.boundingBox();
      expect(modalBox).not.toBeNull();
      expect(submitBox).not.toBeNull();
      expect(modalBox!.x).toBeGreaterThanOrEqual(0);
      expect(modalBox!.y).toBeGreaterThanOrEqual(0);
      expect(modalBox!.x + modalBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(modalBox!.y + modalBox!.height).toBeLessThanOrEqual(viewport.height);
      expect(submitBox!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`facility-liquidation-${viewport.width}x${viewport.height}.png`), fullPage: false });
      await submit.scrollIntoViewIfNeeded();
      const visibleSubmitBox = await submit.boundingBox();
      expect(visibleSubmitBox).not.toBeNull();
      expect(visibleSubmitBox!.y).toBeGreaterThanOrEqual(0);
      expect(visibleSubmitBox!.y + visibleSubmitBox!.height).toBeLessThanOrEqual(viewport.height);
      expect(runtimeIssues).toEqual([]);
    });
  }
});

async function preparePage(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(viewport);
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

async function readGameText(page: Page): Promise<BrowserGameText> {
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  return page.evaluate(() => {
    const renderGameToText = window.render_game_to_text;
    if (typeof renderGameToText !== 'function') {
      throw new Error('browser-test state projection is unavailable.');
    }
    return JSON.parse(renderGameToText()) as BrowserGameText;
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

function completedPublicFee(game: BrowserGameText) {
  return game.completedPayments?.find((payment) => payment.reason === 'PUBLIC_FEE');
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
