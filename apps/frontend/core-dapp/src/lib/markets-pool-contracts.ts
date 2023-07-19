import { ethers } from 'ethers'
import { ExternalContract, SupportedContracts } from './contract.types'

export type SupportedMarketPools =
  | 'ARBITRUM_LONG_POOL'
  | 'ARBITRUM_SHORT_POOL'
  | 'ZKSYNC_LONG_POOL'
  | 'ZKSYNC_SHORT_POOL'
  | 'STARKNET_LONG_POOL'
  | 'STARKNET_SHORT_POOL'

export const ARBITRUM_LONG_POOL_ADDRESS: ExternalContract = {
  arbitrumOne: ethers.constants.AddressZero,
}

export const ARBITRUM_SHORT_POOL_ADDRESS: ExternalContract = {
  arbitrumOne: ethers.constants.AddressZero,
}

export const ZKSYNC_LONG_POOL_ADDRESS: ExternalContract = {
  arbitrumOne: '0x70157bca3D8480c8b55e1cA842AF2C426977e2b6',
}

export const ZKSYNC_SHORT_POOL_ADDRESS: ExternalContract = {
  arbitrumOne: '0x765Be6065C535EC659E3bfc7f2c6e5326FB3281f',
}

export const STARKNET_LONG_POOL_ADDRESS: ExternalContract = {
  arbitrumOne: '0x8E00f07d6CC6577b45160e439b6443FA5Fc25461',
}

export const STARKNET_SHORT_POOL_ADDRESS: ExternalContract = {
  arbitrumOne: '0x740eED9ECF817c30B926354a6FC0245109ba7A17',
}

export const supportedMarketPools: SupportedContracts = {
  ARBITRUM_LONG_POOL: ARBITRUM_LONG_POOL_ADDRESS,
  ARBITRUM_SHORT_POOL: ARBITRUM_SHORT_POOL_ADDRESS,
  ZKSYNC_LONG_POOL: ZKSYNC_LONG_POOL_ADDRESS,
  ZKSYNC_SHORT_POOL: ZKSYNC_SHORT_POOL_ADDRESS,
  STARKNET_LONG_POOL: STARKNET_LONG_POOL_ADDRESS,
  STARKNET_SHORT_POOL: STARKNET_SHORT_POOL_ADDRESS,
}
