/* eslint-disable testing-library/prefer-screen-queries,jest/no-done-callback */
import { ConsoleMessage, expect, test } from '@playwright/test'

const { PLAYWRIGHT_EXPECTED_BUILD_ID, PLAYWRIGHT_SITE_PATH } = process.env

if (PLAYWRIGHT_EXPECTED_BUILD_ID && PLAYWRIGHT_SITE_PATH) {
  test('ensure correct Build ID', async ({ page, browserName }) => {
    // No need for multi-browser here
    // eslint-disable-next-line jest/no-disabled-tests,jest/expect-expect
    test.skip(browserName !== 'chromium')

    const buildId = new Promise<string>((resolve) => {
      const listener = (msg: ConsoleMessage): void => {
        if (msg.text().startsWith('build: ')) {
          resolve(msg.text().replace('build: ', ''))
          page.removeListener('console', listener)
        }
      }

      page.on('console', listener)
    })

    await page.goto(PLAYWRIGHT_SITE_PATH, { timeout: 15_000 })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 5_000)
    })

    // Ensure that the page is interactive
    await page.locator('header').getByRole('button', { name: 'Connect Wallet' }).click()

    expect(await buildId).toEqual(PLAYWRIGHT_EXPECTED_BUILD_ID)
  })
}
