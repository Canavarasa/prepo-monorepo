import { BigNumber } from 'ethers'

export const PROJECT_NAME = 'core-dapp'
export const PREPO_TWITTER = 'https://twitter.com/prepo_io'
export const PREPO_DISCORD = 'https://url.prepo.io/discord-dapp'
export const PREPO_MEDIUM = 'https://medium.com/prepo'
export const PREPO_TESTNET_FORM = 'https://url.prepo.io/whitelist-dapp'
export const PREPO_TERMS_LINK = 'https://url.prepo.io/terms-of-service'
export const PREPO_PRIVACY_POLICY_LINK = 'https://url.prepo.io/privacy-policy'
export const PREPO_ZKSYNC_MARKET_BLOG_POST =
  'https://medium.com/prepo/zksync-pre-token-market-is-live-51e294570849'
export const PREPO_STARKNET_MARKET_BLOG_POST =
  'https://medium.com/prepo/prepo-v1-1-starknet-market-and-more-3ee433b486cb'

export const FEE_DENOMINATOR = 1000000

export const FAKEUSD_AIRDROPPED_ON_TESTNET = 100

// this will directly affect query data of market chart
// when querying historical data from subgraphs, if we're expecting large amount of data
// it's better to specify from what time onwards we want to query to reduce the number of data we're searching
export const PROJECT_START_TIMESTAMP = 1678970408

export const ERC20_UNITS = 18
export const WEI_DENOMINATOR = BigNumber.from(10).pow(ERC20_UNITS)
