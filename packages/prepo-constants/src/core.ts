import { id } from 'ethers/lib/utils'

export const COLLATERAL_FEE_LIMIT = 100000
export const MARKET_FEE_LIMIT = 100000
export const PERCENT_UNIT = 1000000
export const MAX_GLOBAL_PERIOD_LENGTH = 604800
export const MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD = 30000
export const MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_IN_UNITS = 5

export const MINT_HOOK_KEY = id('MarketMintHook')
export const REDEEM_HOOK_KEY = id('MarketRedeemHook')
export const MINT_FEE_PERCENT_KEY = id('MarketMintFeePercent')
export const REDEEM_FEE_PERCENT_KEY = id('MarketRedeemFeePercent')
