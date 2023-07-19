import fetch from 'node-fetch'
import { ethers } from 'ethers'

export async function spawnTenderlyRpc(): Promise<string> {
  if (
    !process.env.TENDERLY_ACCOUNT_ID ||
    !process.env.TENDERLY_PROJECT_ID ||
    !process.env.TENDERLY_DEVNET_TEMPLATE_SLUG ||
    !process.env.TENDERLY_ACCESS_TOKEN
  )
    throw new Error('Missing Tenderly credentials')

  const accountID = process.env.TENDERLY_ACCOUNT_ID
  const projectID = process.env.TENDERLY_PROJECT_ID

  const response = await fetch(
    `https://api.tenderly.co/api/v1/account/${accountID}/project/${projectID}/devnet/container/spawn-rpc`,
    {
      method: 'POST',
      body: JSON.stringify({
        templateSlugOrId: process.env.TENDERLY_DEVNET_TEMPLATE_SLUG,
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': process.env.TENDERLY_ACCESS_TOKEN,
      },
    }
  )

  const body = await response.json()

  if (response.status >= 400) {
    throw new Error('Error when spawning a Tenderly RPC')
  }

  return body.url
}

export async function addBalanceToWallets({
  addresses,
  provider,
}: {
  addresses: string[]
  provider: ethers.providers.JsonRpcProvider
}): Promise<void> {
  await provider.send('tenderly_addBalance', [addresses, '0x21e19e0c9bab2400000'])
}
