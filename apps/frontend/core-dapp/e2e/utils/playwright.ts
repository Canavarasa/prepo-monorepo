/* eslint-disable no-await-in-loop */
import { Page } from '@playwright/test'
import { ethers } from 'ethers'
import { connectMockWallet } from './wallet-connect'
import { TestIds } from '../../src/components/TestId'

export async function connectWalletToPlaywright({
  page,
  rpc,
  wallet,
}: {
  page: Page
  rpc?: { chainId: number; url: string }
  wallet: ethers.Wallet
}): Promise<ReturnType<typeof connectMockWallet>> {
  await page.goto(`/${rpc ? `?rpc=${encodeURIComponent(`${rpc.chainId}:${rpc.url}`)}` : ''}`)
  await page.locator('header').getByRole('button', { name: 'Connect Wallet' }).click()
  await page.getByRole('button', { name: 'WalletConnect' }).click()
  const uri = await page.locator('w3m-qrcode').getAttribute('uri')

  if (uri === null) {
    throw new Error("Couldn't find WalletConnect uri")
  }

  return connectMockWallet({
    wallet,
    walletConnectUri: uri,
  })
}

export async function acceptTerms({ page }: { page: Page }): Promise<void> {
  await page.waitForSelector("[data-testid='terms-scroll']")
  await page.evaluate(() => {
    const element = document.querySelector("[data-testid='terms-scroll']")
    if (!element) return
    element.scrollTop = 10e9
  })

  await page.getByRole('button', { name: 'I Agree' }).click()

  const checkboxes = await page.getByTestId('rules-scroll').getByRole('checkbox').all()
  for (const checkbox of checkboxes) {
    await checkbox.click()
  }

  await page.getByRole('button', { name: 'I Agree' }).click()
}

// TODO consider fetching from chain for precision
export async function queryTotalPortfolioValue({ page }: { page: Page }): Promise<number> {
  await page.getByRole('link', { name: 'Portfolio' }).click()

  // Wait to ensure balance is refreshed
  await new Promise((resolve) => {
    setTimeout(resolve, 10_000)
  })

  const ppoText = await page.getByTestId(TestIds.PortfolioTotalBalance).textContent()
  const ppo = +(ppoText?.replace(' ETH', '') ?? 0)
  await page.goBack()
  return ppo
}

// TODO consider fetching from chain for precision
export async function queryPpoBalance({ page }: { page: Page }): Promise<number> {
  await page.getByRole('link', { name: 'Portfolio' }).click()

  // Wait to ensure balance is refreshed
  await new Promise((resolve) => {
    setTimeout(resolve, 10_000)
  })

  const ppoText = await page.getByTestId(TestIds.PpoBalance).textContent()
  const ppo = +(ppoText ?? 0)
  await page.goBack()
  return ppo
}
