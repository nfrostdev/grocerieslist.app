import { test, expect } from '@playwright/test'

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
  await expect(page.locator('.item__name').filter({ hasText: 'Apples' })).toBeVisible()

  // Toggle "Apples" checked → moves to Checked Items section
  await page.getByRole('checkbox', { name: 'Apples Checked' }).click()
  await expect(page.locator('h2.items__h2', { hasText: 'Checked Items' })).toBeVisible()
  await expect(page.locator('.items__checked .item__name').filter({ hasText: 'Apples' })).toBeVisible()

  // Reload → localStorage persistence
  await page.reload()
  await expect(page.locator('h2.items__h2', { hasText: 'Checked Items' })).toBeVisible()
  await expect(page.locator('.items__checked .item__name').filter({ hasText: 'Apples' })).toBeVisible()

  // Build ?import= URL, then clear storage and re-navigate to test import round-trip
  const importURL = await page.evaluate(() => {
    const lists = JSON.parse(localStorage.getItem('lists') ?? '[]')
    return window.location.origin + '/?import=' + btoa(JSON.stringify(lists[0]))
  })
  await page.evaluate(() => localStorage.clear())
  await page.goto(importURL)
  // App.vue's onMounted reads ?import=, creates list from scratch, renders List.vue
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Test')
  await expect(page.locator('.item__name').filter({ hasText: 'Apples' })).toBeVisible()
})
