import { id } from 'ethers/lib/utils'

export const COLLATERAL_ROLES = [
  id('setDepositFeePercent'),
  id('setWithdrawFeePercent'),
  id('setDepositHook'),
  id('setWithdrawHook'),
]

export const DEPOSIT_RECORD_ROLES = [
  id('setUserDepositCap'),
  id('setGlobalNetDepositCap'),
  id('setAllowedMsgSenders'),
  id('setAccountList'),
]

export const DEPOSIT_HOOK_ROLES = [
  id('setAccountList'),
  id('setCollateral'),
  id('setDepositRecord'),
  id('setDepositsAllowed'),
  id('setTreasury'),
  id('setAmountMultiplier'),
  id('setTokenSender'),
]

export const WITHDRAW_HOOK_ROLES = [
  id('setAccountList'),
  id('setCollateral'),
  id('setDepositRecord'),
  id('setGlobalPeriodLength'),
  id('setGlobalWithdrawLimitPerPeriod'),
  id('setTreasury'),
  id('setAmountMultiplier'),
  id('setTokenSender'),
]

export const TOKEN_SENDER_ROLES = [
  id('setPriceOracle'),
  id('setPriceLowerBound'),
  id('setAllowedMsgSenders'),
  id('setAccountLimitResetPeriod'),
  id('setAccountLimitPerPeriod'),
  id('withdrawERC20'),
]

export const PREPO_MARKET_ROLES = [
  id('setMintHook'),
  id('setRedeemHook'),
  id('setFinalLongPayout'),
  id('setMintingFeePercent'),
  id('setRedemptionFeePercent'),
  id('setHookBeacon'),
  id('setFeeBeacon'),
]

export const ARBITRAGE_BROKER_ROLES = [
  id('buyAndRedeem'),
  id('mintAndSell'),
  id('setAccountList'),
  id('withdrawERC20'),
]
