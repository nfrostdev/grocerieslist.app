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

test('sync: provision → join → bidirectional edits → revoke', async ({ browser }) => {
  const ownerCtx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const editorCtx = await browser.newContext()

  try {
    const ownerPage = await ownerCtx.newPage()
    const editorPage = await editorCtx.newPage()

    // Owner: create list
    await ownerPage.goto('/')
    await ownerPage.getByRole('link', { name: 'create one' }).click()
    await ownerPage.getByPlaceholder('List Name').fill('Sync Flow')
    await ownerPage.getByRole('button', { name: 'Create' }).click()
    await expect(ownerPage.getByRole('heading', { level: 1 })).toHaveText('Sync Flow')

    // Owner: open share sheet — provision fires immediately, enabling sharing
    await ownerPage.getByRole('button', { name: /Share your Sync Flow list/i }).click()
    const copyBtn = ownerPage.getByRole('button', { name: 'Copy link' })
    await expect(copyBtn).toBeVisible({ timeout: 15_000 })

    // a11y check: share sheet (sharing state)
    await checkA11y(ownerPage)

    // Grab join URL via clipboard
    await copyBtn.click()
    const joinUrl = await ownerPage.evaluate(() => navigator.clipboard.readText())
    expect(joinUrl).toMatch(/^https?:\/\/.+#join=.+\..+$/)

    // Close share sheet — provisioned event fires → URL changes to ULID
    await ownerPage.getByRole('button', { name: 'Close share sheet' }).click()
    await expect(ownerPage).toHaveURL(/\/[A-Za-z0-9]{26}$/, { timeout: 5_000 })

    // Editor: join via link
    await editorPage.goto(joinUrl)
    await expect(editorPage.getByRole('heading', { level: 1 })).toHaveText('Sync Flow', { timeout: 10_000 })

    // Owner adds item → editor sees it on next poll
    await ownerPage.getByPlaceholder('Item Name').fill('Milk')
    await ownerPage.locator('#quantity').fill('2')
    await ownerPage.getByRole('button', { name: 'Add' }).click()
    await expect(ownerPage.getByLabel('Milk Name')).toBeVisible()
    await expect(editorPage.getByLabel('Milk Name')).toBeVisible({ timeout: 10_000 })

    // Editor adds item → owner sees it on next poll
    await editorPage.getByPlaceholder('Item Name').fill('Eggs')
    await editorPage.locator('#quantity').fill('12')
    await editorPage.getByRole('button', { name: 'Add' }).click()
    await expect(editorPage.getByLabel('Eggs Name')).toBeVisible()
    await expect(ownerPage.getByLabel('Eggs Name')).toBeVisible({ timeout: 10_000 })

    // Owner: stop sharing (bulk-revokes all editor tokens)
    await ownerPage.getByRole('button', { name: /Share your Sync Flow list/i }).click()
    await expect(ownerPage.getByRole('button', { name: 'Stop sharing' })).toBeVisible({ timeout: 5_000 })
    await ownerPage.getByRole('button', { name: 'Stop sharing' }).click()
    await expect(ownerPage.getByText('Enable sharing')).toBeVisible()

    // a11y check: share sheet (not-sharing state)
    await checkA11y(ownerPage)

    await ownerPage.getByRole('button', { name: 'Close share sheet' }).click()

    // Editor: next poll returns 401 → list removed → redirected to Lists
    await expect(editorPage).toHaveURL('/', { timeout: 15_000 })
  } finally {
    await ownerCtx.close()
    await editorCtx.close()
  }
})
