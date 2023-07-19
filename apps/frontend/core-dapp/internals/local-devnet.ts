/* eslint-disable @typescript-eslint/no-explicit-any,no-console,@typescript-eslint/no-implied-eval */
import dotenv from 'dotenv'
import { stringify } from 'query-string'
import { ethers } from 'ethers'
import { getContractAddress } from 'prepo-utils'
import { parseEther } from 'ethers/lib/utils'
import { addBalanceToWallets, spawnTenderlyRpc } from '../src/utils/tenderly'
import { ImpersonatedSigner } from '../src/utils/ImpersonatedSigner'
import * as contractFactories from '../generated/typechain'
import { supportedContracts } from '../src/lib/supported-contracts'
import { Addresses } from '../e2e/utils/addresses'
import { exec, fork } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

dotenv.config()

const DEV_ADDRESSES = ['0x4F13427ef1E96617745c64506815aF7274D67570']

const isPortInUse = (port: number): Promise<boolean> => {
  const server = createServer(() => {})
  return new Promise<boolean>((resolve, reject) => {
    let errored = false

    server.once('error', (err: any) => {
      errored = true

      if (err.code === 'EADDRINUSE') {
        resolve(true)
      } else {
        reject(err)
      }
    })

    server.listen(port)

    setTimeout(() => {
      if (!errored) {
        resolve(false)
      }
    }, 100)
  }).finally(() => server.close())
}

async function main(): Promise<void> {
  if (!(await isPortInUse(3000))) {
    fork('dev', [], { execPath: 'yarn' })
  }
  const rpc = await spawnTenderlyRpc()

  console.log('Spawned a temporary RPC at', rpc)

  const provider = new ethers.providers.JsonRpcProvider(rpc)

  try {
    const recipe = readFileSync(process.stdin.fd, 'utf-8')
    const executeRecipe = new Function(`
      return async function executeRecipe({ address, factories, impersonate, parseEther }) {
        ${recipe}
      }
    `)()
    await executeRecipe({
      address: (contractName: string) => {
        try {
          return getContractAddress(contractName as any, 'arbitrumOne', supportedContracts)
        } catch (e) {
          return (Addresses as any)[contractName] as string
        }
      },
      factories: contractFactories,
      impersonate: (address: string) => new ImpersonatedSigner(address, provider),
      parseEther,
    })
  } catch (e: any) {
    if (e.code === 'EAGAIN') {
      // No stdin passed, do nothing
    } else {
      throw e
    }
  }

  await addBalanceToWallets({
    addresses: DEV_ADDRESSES,
    provider,
  })

  const open = (() => {
    switch (process.platform) {
      case 'darwin':
        return 'open'
      case 'win32':
        return 'start'
      default:
        return 'xdg-open'
    }
  })()

  exec(`${open} "http://localhost:3000/?${stringify({ rpc: `42161:${rpc}` })}"`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
