import { MockContract } from '@defi-wonderland/smock'
import {
  AccountList,
  Collateral,
  DepositHook,
  DepositRecord,
  ERC20,
  LongShortToken,
  MarketHook,
  PrePOMarket,
  TokenSender,
  UniswapV3OracleUintValue,
  WithdrawHook,
} from './generated'

export type ExtendedDepositHook = DepositHook & {
  tokenSender?: ExtendedTokenSender
}

export type ExtendedWithdrawHook = WithdrawHook & {
  tokenSender?: ExtendedTokenSender
}

export type ExtendedCollateral = Collateral & {
  depositHook?: ExtendedDepositHook
  withdrawHook?: ExtendedWithdrawHook
}

export type MockExtendedDepositHook = MockContract<DepositHook> & {
  tokenSender?: MockExtendedTokenSender
}

export type MockExtendedWithdrawHook = MockContract<WithdrawHook> & {
  tokenSender?: MockExtendedTokenSender
}

export type MockExtendedCollateral = MockContract<Collateral> & {
  depositHook?: MockExtendedDepositHook
  withdrawHook?: MockExtendedWithdrawHook
}

export type ExtendedMarketHook = MarketHook & {
  bypasslist?: AccountList
  allowedMsgSenders?: AccountList
  tokenSender: ExtendedTokenSender
}

export type ExtendedMarket = PrePOMarket & {
  longToken?: ERC20
  shortToken?: ERC20
  mintHook?: ExtendedMarketHook
  redeemHook?: ExtendedMarketHook
}

export type MockExtendedMarketHook = MockContract<MarketHook> & {
  bypasslist?: MockContract<AccountList>
  allowedMsgSenders?: MockContract<AccountList>
  tokenSender?: MockExtendedTokenSender
}

export type MockExtendedMarket = MockContract<PrePOMarket> & {
  longToken?: LongShortToken
  shortToken?: LongShortToken
  mintHook?: MockExtendedMarketHook
  redeemHook?: MockExtendedMarketHook
}

export type ExtendedDepositRecord = DepositRecord & {
  allowedMsgSenders?: AccountList
  bypasslist?: AccountList
}

export type MockExtendedDepositRecord = MockContract<DepositRecord> & {
  allowedMsgSenders?: MockContract<AccountList>
  bypasslist?: MockContract<AccountList>
}

export type ExtendedTokenSender = TokenSender & {
  allowedMsgSenders?: AccountList
  twapPrice?: UniswapV3OracleUintValue
}

export type MockExtendedTokenSender = MockContract<TokenSender> & {
  allowedMsgSenders?: MockContract<AccountList>
  twapPrice?: MockContract<UniswapV3OracleUintValue>
}
