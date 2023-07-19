/* eslint-disable testing-library/prefer-screen-queries,jest/no-done-callback */
import { expect, test } from '@playwright/test'
import { NETWORKS } from 'prepo-constants'
import { Wallet } from 'ethers'
import { increaseDepositLimits } from './utils/limits'
import {
  acceptTerms,
  connectWalletToPlaywright,
  queryTotalPortfolioValue,
} from './utils/playwright'
import { addBalanceToWallets, spawnTenderlyRpc } from '../src/utils/tenderly'
import { TestIds } from '../src/components/TestId'

test('The user receives at least the minimum amount advertised in the UI, after slippage', async ({
  page,
}) => {
  const wallet = Wallet.createRandom()

  const rpcUrl = await spawnTenderlyRpc()

  // The front-end doesn't subscribe to changes in deposit limits because they
  // are not expected to change frequently.
  // Increase the limits before loading the front-end.
  await increaseDepositLimits({ rpcUrl })

  const walletConnect = await connectWalletToPlaywright({
    page,
    rpc: {
      chainId: NETWORKS.arbitrumOne.chainId,
      url: rpcUrl,
    },
    wallet,
  })

  await addBalanceToWallets({
    addresses: [wallet.address],
    provider: walletConnect.provider,
  })

  await acceptTerms({ page })

  await page.getByRole('link', { name: 'Portfolio' }).click()
  await page.getByRole('link', { name: 'Deposit →' }).click()

  await page.getByPlaceholder('0').fill('10')

  const slippageTextContent = await page
    .getByTestId(TestIds.DepositSummarySlippage)
    .locator('.summary-record-value')
    .textContent()
  const minReceivedTextContent = await page
    .getByTestId(TestIds.DepositSummaryMinReceived)
    .textContent()

  if (slippageTextContent === null || minReceivedTextContent === null) {
    throw new Error("Couldn't get data from the summary")
  }

  const slippage = +slippageTextContent.replace('%', '') / 100
  const minReceived = +minReceivedTextContent.replace(' ETH', '')

  await page.getByRole('button', { name: 'Deposit', exact: true }).click()

  const hash = await walletConnect.waitForTxHash()
  await expect(page.getByTestId(TestIds.Toast)).toHaveText('Deposit Confirmed')
  await expect(page.locator(`[data-testid="${TestIds.Toast}"] a`)).toHaveAttribute(
    'href',
    `https://arbiscan.io/tx/${hash}`
  )

  const balanceAfter = await queryTotalPortfolioValue({ page })

  expect(balanceAfter).toBeGreaterThanOrEqual(minReceived * (1 - slippage))

  await walletConnect.disconnect()
})
