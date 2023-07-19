/* eslint-disable testing-library/prefer-screen-queries,jest/no-done-callback */
import { expect, test } from '@playwright/test'
import { Wallet } from 'ethers'
import { NETWORKS } from 'prepo-constants'
import { acceptTerms, connectWalletToPlaywright, queryPpoBalance } from './utils/playwright'
import { addBalanceToWallets, spawnTenderlyRpc } from '../src/utils/tenderly'
import { TestIds } from '../src/components/TestId'

// For testing purposes only, don't send real assets to it
const devWallet = Wallet.fromMnemonic(
  'end hungry when acid size margin jazz wedding tool spread gain proof'
)

test('connect a wallet', async ({ page }) => {
  const walletConnect = await connectWalletToPlaywright({
    page,
    wallet: devWallet,
  })

  expect(await page.getByTestId(TestIds.SettingsDropdownWallet).textContent()).toEqual(
    '0x82dC...6E3'
  )

  await walletConnect.disconnect()
})

test('deposit and trade', async ({ page }) => {
  const walletConnect = await connectWalletToPlaywright({
    page,
    rpc: {
      chainId: NETWORKS.arbitrumOne.chainId,
      url: await spawnTenderlyRpc(),
    },
    wallet: devWallet,
  })

  await addBalanceToWallets({
    addresses: [devWallet.address],
    provider: walletConnect.provider,
  })

  await acceptTerms({ page })

  const ppoBefore = await queryPpoBalance({ page })

  await page.getByPlaceholder('0').click()
  await page.getByPlaceholder('0').fill('1')

  await page.getByTestId(TestIds.OpenTradeSummaryHeader).click()

  const slippageTextContent = await page
    .getByTestId(TestIds.OpenTradeSummarySlippage)
    .locator('.summary-record-value')
    .textContent()
  const ppoTextContent = await page
    .getByTestId(TestIds.OpenTradeSummaryPpo)
    .locator('.ppo-amount')
    .textContent()

  if (slippageTextContent === null || ppoTextContent === null) {
    throw new Error("Couldn't get data from the summary")
  }

  const slippage = +slippageTextContent.replace('%', '') / 100
  const ppoReceived = +ppoTextContent

  await page.getByRole('button', { name: 'Deposit And Trade' }).click()

  const hash = await walletConnect.waitForTxHash()

  await expect(page.getByTestId(TestIds.Toast)).toHaveText('Deposit & Trade Confirmed')
  await expect(page.locator(`[data-testid="${TestIds.Toast}"] a`)).toHaveAttribute(
    'href',
    `https://arbiscan.io/tx/${hash}`
  )

  const ppoAfter = await queryPpoBalance({ page })

  const minimumIncrease = ppoReceived * (1 - slippage)
  const actualIncrease = ppoAfter - ppoBefore

  expect(actualIncrease).toBeGreaterThanOrEqual(minimumIncrease)

  await walletConnect.disconnect()
})
