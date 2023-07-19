import { ExternalContract, SupportedContracts } from './contract.types'

export type SupportedMarkets = 'ARBITRUM_MARKET' | 'ZKSYNC_MARKET' | 'STARKNET_MARKET'

export const ARBITRUM_MARKET_ADDRESS: ExternalContract = {
  arbitrumOne: '0x4b374358ad7Cafe246f2Cf51b1164885ed3D743d',
}

export const ZKSYNC_MARKET_ADDRESS: ExternalContract = {
  arbitrumOne: '0xd14ff3165ddbe69c12cb774326386f5d34a288dc',
}

export const STARKNET_MARKET_ADDRESS: ExternalContract = {
  arbitrumOne: '0x1843Dff25381Dfe5A2F270b46FA042518Ff431cf',
}

export const supportedMarkets: SupportedContracts = {
  ARBITRUM_MARKET: ARBITRUM_MARKET_ADDRESS,
  ZKSYNC_MARKET: ZKSYNC_MARKET_ADDRESS,
  STARKNET_MARKET: STARKNET_MARKET_ADDRESS,
}
