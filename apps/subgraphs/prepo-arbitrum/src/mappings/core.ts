import { Deposit, Withdraw, Deposit1 } from '../generated/types/CollateralToken/CollateralToken'
import { Redemption } from '../generated/types/templates/PrePOMarket/PrePOMarket'
import { Swap } from '../generated/types/templates/UniswapV3Pool/UniswapV3Pool'
import { updatePosition } from '../utils/positions'
import {
  addDepositTransaction,
  addRedemptionTransaction,
  addUniswapV3SwapTransaction,
  addWithdrawTransaction,
} from '../utils/transactions'

export function handleDeposit(event: Deposit): void {
  addDepositTransaction(
    event,
    event.params.depositor,
    event.params.amountAfterFee,
    event.params.fee
  )
}

export function handleDeposit1(event: Deposit1): void {
  addDepositTransaction(
    event,
    event.params.recipient,
    event.params.amountAfterFee,
    event.params.fee
  )
}

export function handleWithdraw(event: Withdraw): void {
  addWithdrawTransaction(event)
}

export function handleRedemption(event: Redemption): void {
  addRedemptionTransaction(event)
}

export function handleUniswapV3Swap(event: Swap): void {
  addUniswapV3SwapTransaction(event)
  updatePosition(event)
}
