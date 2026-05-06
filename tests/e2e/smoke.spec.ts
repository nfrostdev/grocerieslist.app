import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function checkA11y (page: Page) {
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
  await expect(page).toHaveURL(/\/[a-f0-9]{8}$/)
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
  await expect(page).toHaveURL(/\/[a-f0-9]{8}$/)
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
  await expect(page).toHaveURL(/\/[a-f0-9]{8}$/)
  await page.getByRole('link', { name: 'My Lists' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: /A11y Test/ })).toBeVisible()
  await checkA11y(page)
})

test('share import: fragment payload imports list and navigates', async ({ page }) => {
  const { encodeList } = await import('../../src/utils/share')
  const list = {
    id: 'shr1234a',
    n: 'Shared Costco',
    i: [
      { id: 'sit00001', n: 'Bread', q: '1', c: 0, u: 1700000000000, d: 0 },
      { id: 'sit00002', n: 'Eggs', q: '12', c: 0, u: 1700000000001, d: 0 }
    ]
  }
  const payload = encodeList(list)

  await page.goto(`/#import=${payload}`)

  await expect(page.getByRole('heading', { name: 'Import shared list?' })).toBeVisible()
  await expect(page.getByText('Shared Costco')).toBeVisible()
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page).toHaveURL(`/${list.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Shared Costco' })).toBeVisible()
  await expect(page.locator('.item__name').first()).toHaveValue('Bread')
})

test('share import: merge keeps newer local edits', async ({ page }) => {
  const { encodeList } = await import('../../src/utils/share')
  const list = {
    id: 'shr5678b',
    n: 'Pantry',
    i: [{ id: 'sit10001', n: 'Flour', q: '1', c: 0, u: 100, d: 0 }]
  }

  await page.addInitScript((seed) => {
    localStorage.setItem('lists', JSON.stringify([{
      id: seed.id,
      n: seed.n,
      i: [{ id: 'sit10001', n: 'Flour', q: '5', c: 0, u: 999, d: 0 }]
    }]))
  }, list)

  const payload = encodeList(list)
  await page.goto(`/#import=${payload}`)

  await expect(page.getByRole('heading', { name: 'Update existing list?' })).toBeVisible()
  await page.getByRole('button', { name: 'Merge' }).click()

  await expect(page).toHaveURL(`/${list.id}`)
  await expect(page.locator('.item__quantity__input').first()).toHaveValue('5')
})
