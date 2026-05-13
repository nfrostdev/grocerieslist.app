import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function checkA11y (page: Page) {
  // Webfonts must be settled before axe samples computed colors — un-hinted
  // fallback glyphs have wider AA fringes that can blend into bg and trip
  // color-contrast under parallel load. See #87.
  await page.evaluate(() => document.fonts.ready)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const violations = results.violations.filter(v =>
    v.impact === 'serious' || v.impact === 'critical'
  )
  expect(violations, violations.map(v => `${v.id}: ${v.description}`).join('\n')).toHaveLength(0)
}

test('smoke: critical path', async ({ page }) => {
  // Visit / with no lists → "create one" link present
  await page.goto('/')
  await page.getByRole('link', { name: 'create one' }).click()
  await expect(page).toHaveURL('/new')

  // Create list named "Test"
  await page.getByPlaceholder('List Name').fill('Test')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page).toHaveURL(/\/[a-f0-9-]{36}$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Test')

  // Add item "Apples" qty 3
  await page.getByPlaceholder('Item Name').fill('Apples')
  await page.locator('#quantity').fill('3')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.locator('.item__name').filter({ hasText: '' }).first()).toBeVisible()

  // Toggle "Apples" checked → moves to Checked Items section
  await page.getByRole('checkbox', { name: 'Apples Checked' }).click()
  await expect(page.locator('h2.items__h2', { hasText: 'Checked Items' })).toBeVisible()
  await expect(page.locator('.items__checked .item__name').first()).toBeVisible()

  // Reload → localStorage persistence
  await page.reload()
  await expect(page.locator('h2.items__h2', { hasText: 'Checked Items' })).toBeVisible()
  await expect(page.locator('.items__checked .item__name').first()).toBeVisible()
})

test('a11y: Lists route (empty)', async ({ page }) => {
  await page.goto('/')
  await checkA11y(page)
})

test('a11y: New route', async ({ page }) => {
  await page.goto('/new')
  await checkA11y(page)
})

test('a11y: List route — initial state', async ({ page }) => {
  await page.goto('/new')
  await page.getByPlaceholder('List Name').fill('A11y Test')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page).toHaveURL(/\/[a-f0-9-]{36}$/)
  // Wait for route transition to complete before axe scans
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A11y Test')
  await checkA11y(page)
})

test('a11y: List route — after adding an item', async ({ page }) => {
  await page.goto('/new')
  await page.getByPlaceholder('List Name').fill('A11y Test')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByPlaceholder('Item Name').fill('Bananas')
  await page.locator('#quantity').fill('2')
  await page.getByRole('button', { name: 'Add' }).click()
  await checkA11y(page)
})

test('a11y: List route — after checking an item', async ({ page }) => {
  await page.goto('/new')
  await page.getByPlaceholder('List Name').fill('A11y Test')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByPlaceholder('Item Name').fill('Bananas')
  await page.locator('#quantity').fill('2')
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('checkbox', { name: 'Bananas Checked' }).click()
  await checkA11y(page)
})

test('a11y: Lists route — after creating a list', async ({ page }) => {
  await page.goto('/new')
  await page.getByPlaceholder('List Name').fill('A11y Test')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page).toHaveURL(/\/[a-f0-9-]{36}$/)
  await page.getByRole('link', { name: 'My Lists' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: /A11y Test/ })).toBeVisible()
  await checkA11y(page)
})
