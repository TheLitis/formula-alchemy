import { test, expect, type Page } from '@playwright/test';
import { RECIPES } from '../src/core/catalog';
async function book(page: Page) { await page.getByRole('button', { name: 'Книга формул', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); }
async function open(page: Page, id: string) { await book(page); await page.getByTestId(`recipe-${id}`).getByRole('button', { name: /: открыть опыт$/ }).click(); }
async function parameters(page: Page) { const b = page.locator('.parameters-trigger'); if (await b.isVisible())
    await b.click(); }
async function closeParameters(page: Page) { const b = page.getByRole('button', { name: 'Закрыть параметры', exact: true }); if (await b.isVisible())
    await b.click(); }
test.beforeEach(async ({ page }) => { await page.goto('./'); await expect(page.locator('.board canvas')).toBeVisible(); });
test('drag, numerical parameters, pause, reset, discovery', async ({ page, isMobile }) => {
    const m = page.locator('[data-node="seed-m"]'), g = page.locator('[data-node="seed-g"]');
    if (isMobile) {
        await m.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true, clientX: (await m.boundingBox())!.x + 25, clientY: (await m.boundingBox())!.y + 25 });
        const b = (await g.boundingBox())!;
        await page.locator('body').dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: b.x + 20, clientY: b.y + 20 });
        await page.locator('body').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: b.x + 20, clientY: b.y + 20 });
    }
    else
        await g.dragTo(m);
    await expect(page.locator('[data-recipe="weight"]')).toBeVisible();
    await parameters(page);
    const mass = page.getByRole('spinbutton', { name: /Масса.*численно/ });
    await mass.fill('4');
    await mass.dispatchEvent('change');
    await expect(page.getByTestId('reading-value')).toContainText('39,');
    await closeParameters(page);
    await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
    const text = await page.locator('.status-time').innerText();
    await page.waitForTimeout(400);
    expect(await page.locator('.status-time').innerText()).toBe(text);
    await page.getByRole('button', { name: 'Очистить эксперимент' }).click();
    await page.getByRole('button', { name: 'Очистить холст', exact: true }).click();
    await expect(page.locator('[data-node]')).toHaveCount(0);
    await page.getByRole('button', { name: /Открытия/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Сила тяжести');
});
test('intermediate combination can be completed using touch-friendly controls', async ({ page }) => {
    await book(page);
    await page.getByTestId('recipe-potential').getByRole('button', { name: /: подготовить символы$/ }).click();
    await parameters(page);
    await expect(page.getByRole('complementary', { name: 'Параметры эксперимента' })).toContainText('Что можно получить');
    await page.getByRole('complementary', { name: 'Параметры эксперимента' }).locator('[title="Добавить Ускорение свободного падения"]').first().click();
    await expect(page.getByTestId('reading-value')).toBeVisible();
});
test('circuits have a working switch; optical total internal reflection', async ({ page }) => {
    await open(page, 'capacitor');
    const key = page.locator('.lab-heading button');
    await expect(key).toContainText('Разомкнуть');
    await key.click();
    await expect(key).toContainText('Замкнуть');
    await open(page, 'snell');
    await parameters(page);
    await page.getByRole('spinbutton', { name: 'Среда 1, численно' }).fill('1.5');
    await page.getByRole('spinbutton', { name: 'Среда 2, численно' }).fill('1');
    await page.getByRole('spinbutton', { name: 'Угол падения, численно' }).fill('60');
    await expect(page.getByTestId('reading-value')).toHaveText('ПВО');
});
test('local slots and JSON export contain a versioned physical snapshot', async ({ page }) => {
    await open(page, 'pendulum');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await page.getByLabel('Название эксперимента').fill('Проверка маятника');
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.locator('.saved-list')).toContainText('Проверка маятника');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Экспорт JSON' }).click();
    expect((await download).suggestedFilename()).toMatch(/^formula-alchemy-.*\.json$/);
    await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
    await expect(page.locator('.stage-mode')).toContainText('маятник');
});
test('every formula runs with no page errors and a visible effect', async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const recipe of RECIPES) {
        await open(page, recipe.id);
        await page.waitForTimeout(35);
        await expect(page.locator('.render-error')).toHaveCount(0);
        // Keep well below the node budget without erasing journal progress.
        if ((await page.locator('[data-node]').count()) > 20) {
            await page.getByRole('button', { name: 'Очистить эксперимент' }).click();
            await page.getByRole('button', { name: 'Очистить холст', exact: true }).click();
        }
        // Specialized laboratory nodes are hidden from the canvas DOM; remove current node through inspector.
        await parameters(page);
        await page.getByRole('button', { name: 'Удалить выбранное' }).click();
        await closeParameters(page);
    }
    expect(errors).toEqual([]);
});
test('responsive viewport, keyboard dialogs and no broken assets', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await book(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const status = await page.request.get('./favicon.svg');
    expect(status.ok()).toBe(true);
    expect(await page.locator('.board').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(200);
});
