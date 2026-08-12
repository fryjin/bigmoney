import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

type BrowserGameText = {
  flow: string;
  status: string;
  domainRevision?: number;
  lastEventTypes?: string[];
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

test('Scenario A: solvent rent payment completes through the normal turn flow', async ({ page }) => {
  const runtimeIssues = watchRuntime(page);
  await page.setViewportSize({ width: 1194, height: 834 });
  await visitFixture(page, 'solvent-rent');

  await page.locator('.dice-button').click();
  await expectFlow(page, 'turnEnd');

  const paid = await readGameText(page);
  expect(paid.pendingLiquidation).toBeNull();
  expect(player(paid, 'P2')?.cash).toBe(25);
  expect(player(paid, 'P1')?.cash).toBe(575);
  await expect(page.locator('.liquidation-modal')).toHaveCount(0);
  await expect(page.locator('.end-turn')).toBeVisible();

  await page.locator('.end-turn').click();
  await expectFlow(page, 'awaitingHandoff');
  expect(await readGameText(page)).toEqual({
    flow: 'awaitingHandoff',
    status: 'IN_PROGRESS',
    privateInfoHidden: true
  });
  await expect(page.locator('.private-info-hidden .control-dock')).toHaveCount(0);
  await expect(page.locator('.private-info-hidden .current-player-card:not(.privacy-card)')).toHaveCount(0);
  await expect(page.locator('.private-info-hidden .privacy-card')).toBeVisible();

  await page.locator('.handoff-action').click();
  await expectFlow(page, 'turnReady');
  expect(runtimeIssues).toEqual([]);
});

test('Scenarios B, C, D, G: liquidation remains canonical through partial recovery and payment', async ({
  page
}) => {
  const runtimeIssues = watchRuntime(page);
  await page.setViewportSize({ width: 1194, height: 834 });
  await openLiquidation(page, 'partial-liquidation');

  const beforeLiquidation = await readGameText(page);
  const paymentId = beforeLiquidation.pendingLiquidation?.paymentId;
  expect(paymentId).toBeTruthy();
  expect(beforeLiquidation.pendingLiquidation).toMatchObject({
    payerId: 'P2',
    receiverId: 'P1',
    amount: 75,
    reason: 'RENT'
  });
  await expect(page.locator('.liquidation-submit')).toBeDisabled();
  await expect(page.locator('.dice-button')).toBeDisabled();

  await page.locator('.liquidation-property').nth(0).click();
  await expect(page.locator('.liquidation-property').nth(0)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.liquidation-submit').dblclick();
  await expectFlow(page, 'awaitingLiquidation');

  const partiallyLiquidated = await readGameText(page);
  expect(partiallyLiquidated.pendingLiquidation?.paymentId).toBe(paymentId);
  expect(player(partiallyLiquidated, 'P2')?.cash).toBe(45);
  expect(property(partiallyLiquidated, 'A2')).toEqual({ id: 'A2', ownerId: null, level: 0 });
  expect(property(partiallyLiquidated, 'A3')).toEqual({ id: 'A3', ownerId: 'P2', level: 0 });
  await expect(page.locator('.liquidation-property')).toHaveCount(1);
  await expect(page.locator('.liquidation-submit')).toBeDisabled();

  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.locator('.session-entry-card')).toBeVisible();
  await page.locator('.session-entry-card .primary-action').click();
  await expectFlow(page, 'awaitingLiquidation');

  const restored = await readGameText(page);
  expect(restored.pendingLiquidation?.paymentId).toBe(paymentId);
  expect(restored.domainRevision).toBe(0);
  expect(restored.lastEventTypes).toEqual([]);
  expect(property(restored, 'A2')).toEqual({ id: 'A2', ownerId: null, level: 0 });
  expect(property(restored, 'A3')).toEqual({ id: 'A3', ownerId: 'P2', level: 0 });
  await expect(page.locator('.liquidation-property')).toHaveCount(1);
  await expect(page.locator('.liquidation-submit')).toBeDisabled();
  await expect(page.locator('.dice-button')).toBeDisabled();

  await page.locator('.liquidation-property').click();
  await page.locator('.liquidation-submit').dblclick();
  await expectFlow(page, 'turnEnd');

  const paid = await readGameText(page);
  expect(paid.pendingLiquidation).toBeNull();
  expect(player(paid, 'P2')?.cash).toBe(5);
  expect(player(paid, 'P1')?.cash).toBe(575);
  expect(property(paid, 'A3')).toEqual({ id: 'A3', ownerId: null, level: 0 });
  expect(runtimeIssues).toEqual([]);
});

test('Scenario E: a three-player fixture reaches bankruptcy and an off-turn handoff through UI', async ({
  page
}, testInfo) => {
  const runtimeIssues = watchRuntime(page);
  await page.setViewportSize({ width: 1194, height: 834 });
  await openLiquidation(page, 'three-player-bankruptcy-handoff');

  await page.locator('.liquidation-property').click();
  await page.locator('.liquidation-submit').dblclick();
  await expectFlow(page, 'presentingBankruptcy');

  const bankrupt = await readGameText(page);
  expect(player(bankrupt, 'P2')).toMatchObject({ cash: 0, bankrupt: true });
  expect(player(bankrupt, 'P1')?.cash).toBe(540);
  expect(player(bankrupt, 'P3')).toMatchObject({ cash: 500, bankrupt: false });
  expect(property(bankrupt, 'A2')).toEqual({ id: 'A2', ownerId: null, level: 0 });
  await expect(page.locator('.bankruptcy-card .primary-action')).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath('bankruptcy-1194x834.png'),
    fullPage: false
  });

  await page.locator('.bankruptcy-card .primary-action').dblclick();
  await expectFlow(page, 'awaitingHandoff');
  expect(await readGameText(page)).toEqual({
    flow: 'awaitingHandoff',
    status: 'IN_PROGRESS',
    privateInfoHidden: true
  });
  await expect(page.locator('.private-info-hidden .players-bar')).toBeVisible();
  await expect(page.locator('.private-info-hidden .current-player-card:not(.privacy-card)')).toHaveCount(0);
  await expect(page.locator('.private-info-hidden .privacy-card')).toBeVisible();
  await expect(page.locator('.private-info-hidden .control-dock')).toHaveCount(0);

  await page.locator('.handoff-action').click();
  await expectFlow(page, 'turnReady');
  expect((await readGameText(page)).activePlayerId).toBe('P3');
  expect(runtimeIssues).toEqual([]);
});

test('Scenarios F and H: final bankruptcy enters finished and restores without replaying events', async ({
  page
}, testInfo) => {
  const runtimeIssues = watchRuntime(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLiquidation(page, 'two-player-bankruptcy-finished');

  await page.locator('.liquidation-property').click();
  await page.locator('.liquidation-submit').dblclick();
  await expectFlow(page, 'presentingFinished');
  await expect(page.locator('.winner-card .primary-action')).toBeEnabled();

  const presenting = await readGameText(page);
  expect(presenting.status).toBe('FINISHED');
  expect(presenting.winnerId).toBe('P1');
  expect(player(presenting, 'P2')).toMatchObject({ cash: 0, bankrupt: true });
  expect(player(presenting, 'P1')?.cash).toBe(540);
  await page.screenshot({
    path: testInfo.outputPath('finished-1440x900.png'),
    fullPage: false
  });

  await page.locator('.winner-card .primary-action').dblclick();
  await expectFlow(page, 'finished');
  const finished = await readGameText(page);
  expect(finished.lastEventTypes).toContain('GAME_FINISHED');
  await expect(page.locator('.dice-button')).toHaveCount(0);
  await expect(page.locator('.end-turn')).toHaveCount(0);

  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.locator('.session-entry-card')).toBeVisible();
  await page.locator('.session-entry-card .primary-action').click();
  await expectFlow(page, 'finished');

  const restored = await readGameText(page);
  expect(restored.status).toBe('FINISHED');
  expect(restored.winnerId).toBe('P1');
  expect(restored.domainRevision).toBe(0);
  expect(restored.lastEventTypes).toEqual([]);
  expect(restored.players).toEqual(finished.players);
  expect(restored.properties).toEqual(finished.properties);
  await expect(page.locator('.dice-button')).toHaveCount(0);
  await expect(page.locator('.end-turn')).toHaveCount(0);
  expect(runtimeIssues).toEqual([]);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1194, height: 834 },
  { width: 1440, height: 900 }
]) {
  test(`liquidation interaction fits ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const runtimeIssues = watchRuntime(page);
    await page.setViewportSize(viewport);
    await openLiquidation(page, 'partial-liquidation');

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
    await page.screenshot({
      path: testInfo.outputPath(`liquidation-${viewport.width}x${viewport.height}.png`),
      fullPage: false
    });
    await submit.scrollIntoViewIfNeeded();
    const visibleSubmitBox = await submit.boundingBox();
    expect(visibleSubmitBox).not.toBeNull();
    expect(visibleSubmitBox!.y).toBeGreaterThanOrEqual(0);
    expect(visibleSubmitBox!.y + visibleSubmitBox!.height).toBeLessThanOrEqual(viewport.height);
    expect(runtimeIssues).toEqual([]);
  });
}

async function openLiquidation(page: Page, fixture: string): Promise<void> {
  await visitFixture(page, fixture);
  await page.locator('.dice-button').click();
  await expectFlow(page, 'awaitingLiquidation');
  await expect(page.locator('.liquidation-modal')).toBeVisible();
}

async function visitFixture(page: Page, fixture: string): Promise<void> {
  await page.goto(`/?fixture=${fixture}`);
  await expectFlow(page, 'turnReady');
}

async function readGameText(page: Page): Promise<BrowserGameText> {
  return page.evaluate(() => {
    if (typeof window.render_game_to_text !== 'function') {
      throw new Error('browser-test state projection is unavailable.');
    }
    return JSON.parse(window.render_game_to_text()) as BrowserGameText;
  });
}

async function expectFlow(page: Page, flow: string): Promise<void> {
  await expect.poll(async () => (await readGameText(page)).flow).toBe(flow);
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
      issues.push(
        `${message.type()}: ${message.text()} (${location.url}:${location.lineNumber})`
      );
    }
  });
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      issues.push(`http ${response.status()}: ${response.url()}`);
    }
  });
  return issues;
}
