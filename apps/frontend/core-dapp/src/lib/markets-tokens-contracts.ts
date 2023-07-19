import { ExternalContract } from './contract.types'

export type SupportedMarketTokens =
  | 'ARBITRUM_LONG_TOKEN'
  | 'ARBITRUM_SHORT_TOKEN'
  | 'ZKSYNC_LONG_TOKEN'
  | 'ZKSYNC_SHORT_TOKEN'
  | 'STARKNET_LONG_TOKEN'
  | 'STARKNET_SHORT_TOKEN'

export const ARBITRUM_LONG_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x513b37deeff647c4836accc1918de68d7b9da8b4',
}

export const ARBITRUM_SHORT_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x468713c658978b3f6600a5379f871242fd553554',
}

export const ZKSYNC_LONG_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x35cB5b723429A27d4bD1cFbF28dAB18C49377BE6',
}

export const ZKSYNC_SHORT_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x2b832c69ec73afe7dc358f59ed880e17e75f6b45',
}

export const STARKNET_LONG_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x5de776F7906f82616C8fc65E1B3Ce7cFe9eB1A37',
}

export const STARKNET_SHORT_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x540e0CF0C22EAD7DE293798d182E99C8FB18D1F1',
}

type SupportedMarketTokensContract = {
  [key in SupportedMarketTokens]: ExternalContract
}

export const supportedMarketTokens: SupportedMarketTokensContract = {
  ARBITRUM_LONG_TOKEN: ARBITRUM_LONG_TOKEN_ADDRESS,
  ARBITRUM_SHORT_TOKEN: ARBITRUM_SHORT_TOKEN_ADDRESS,
  ZKSYNC_LONG_TOKEN: ZKSYNC_LONG_TOKEN_ADDRESS,
  ZKSYNC_SHORT_TOKEN: ZKSYNC_SHORT_TOKEN_ADDRESS,
  STARKNET_LONG_TOKEN: STARKNET_LONG_TOKEN_ADDRESS,
  STARKNET_SHORT_TOKEN: STARKNET_SHORT_TOKEN_ADDRESS,
}
