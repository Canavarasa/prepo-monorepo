import { PREPO_STARKNET_MARKET_BLOG_POST, PREPO_ZKSYNC_MARKET_BLOG_POST } from './constants'
import { Market } from '../types/market.types'

export const arbitrum: Market = {
  address: 'ARBITRUM_MARKET',
  iconName: 'arbitrum',
  name: 'Arbitrum',
  type: 'preICO',
  companyName: 'Arbitrum',
  totalSupply: 10_000_000_000,
  urlId: 'arbitrum',
  valuationMultiplier: 1_000_000_000,
  hideExpiry: true,
  long: {
    tokenAddress: 'ARBITRUM_LONG_TOKEN',
    poolAddress: 'ARBITRUM_LONG_POOL',
  },
  short: {
    tokenAddress: 'ARBITRUM_SHORT_TOKEN',
    poolAddress: 'ARBITRUM_SHORT_POOL',
  },
  static: {
    valuationRange: [5000000000, 25000000000],
  },
  version: 'v1.0',
}

export const zkSync: Market = {
  address: 'ZKSYNC_MARKET',
  iconName: 'zksync',
  name: 'zkSync',
  type: 'preICO',
  companyName: 'zkSync',
  urlId: 'zksync',
  long: {
    tokenAddress: 'ZKSYNC_LONG_TOKEN',
    poolAddress: 'ZKSYNC_LONG_POOL',
  },
  short: {
    tokenAddress: 'ZKSYNC_SHORT_TOKEN',
    poolAddress: 'ZKSYNC_SHORT_POOL',
  },
  static: {
    valuationRange: [3_000_000_000, 15_000_000_000],
  },
  version: 'v1.0',
  settlementDocsLink: PREPO_ZKSYNC_MARKET_BLOG_POST,
}

export const starknet: Market = {
  address: 'STARKNET_MARKET',
  iconName: 'starknet',
  name: 'Starknet',
  type: 'preICO',
  companyName: 'Starknet',
  urlId: 'starknet',
  long: {
    tokenAddress: 'STARKNET_LONG_TOKEN',
    poolAddress: 'STARKNET_LONG_POOL',
  },
  short: {
    tokenAddress: 'STARKNET_SHORT_TOKEN',
    poolAddress: 'STARKNET_SHORT_POOL',
  },
  static: {
    valuationRange: [3_000_000_000, 9_000_000_000],
  },
  version: 'v1.1',
  settlementDocsLink: PREPO_STARKNET_MARKET_BLOG_POST,
}

export const markets: Market[] = [arbitrum, zkSync, starknet]
