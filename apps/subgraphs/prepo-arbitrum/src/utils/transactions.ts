import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { ERC20_DENOMINATORS, TransactionType, ZERO_BI } from './constants'
import { getRateToEth } from './balancerPool'
import { convertTokenToDecimal } from './math'
import { Withdraw } from '../generated/types/CollateralToken/CollateralToken'
import { Pool, Token, Transaction } from '../generated/types/schema'
import { Swap } from '../generated/types/templates/UniswapV3Pool/UniswapV3Pool'
import { Redemption } from '../generated/types/templates/PrePOMarket/PrePOMarket'

export function makeHistoricalEventId(
  hashString: string,
  ownerAddressString: string,
  action: string,
  transactionLogIndex: BigInt
): string {
  return `${hashString}-${ownerAddressString}-${action}-${transactionLogIndex.toString()}`
}

export function addDepositTransaction(
  event: ethereum.Event,
  recipientAddress: Address,
  amountAfterFee: BigInt,
  fee: BigInt
): void {
  const collateralToken = Token.load(event.address.toHexString())
  if (!collateralToken) return

  const hashString = event.transaction.hash.toHexString()
  const ownerAddressString = recipientAddress.toHexString()
  const id = makeHistoricalEventId(
    hashString,
    ownerAddressString,
    TransactionType.deposit,
    event.transactionLogIndex
  )
  const tx = new Transaction(id)
  const rateToEth = getRateToEth()

  const amountBI = amountAfterFee.plus(fee).times(rateToEth).div(ERC20_DENOMINATORS)

  const amountBD = convertTokenToDecimal(amountBI, collateralToken.decimals)

  tx.action = TransactionType.deposit
  tx.amount = amountBD
  tx.createdAtBlockNumber = event.block.number
  tx.createdAtTimestamp = event.block.timestamp
  tx.fee = fee
  tx.hash = hashString
  tx.contractAddress = event.address.toHexString()
  tx.tokenAddress = event.address.toHexString()
  tx.ownerAddress = ownerAddressString
  tx.rateToEth = rateToEth

  tx.save()
}

export function addWithdrawTransaction(event: Withdraw): void {
  const collateralToken = Token.load(event.address.toHexString())
  if (!collateralToken) return

  const hashString = event.transaction.hash.toHexString()
  const ownerAddressString = event.transaction.from.toHexString()
  const id = makeHistoricalEventId(
    hashString,
    ownerAddressString,
    TransactionType.withdraw,
    event.transactionLogIndex
  )
  const tx = new Transaction(id)
  const rateToEth = getRateToEth()

  const amountBI = event.params.amountAfterFee
    .plus(event.params.fee)
    .times(rateToEth)
    .div(ERC20_DENOMINATORS)

  const amountBD = convertTokenToDecimal(amountBI, collateralToken.decimals)

  tx.action = TransactionType.withdraw
  tx.amount = amountBD
  tx.createdAtBlockNumber = event.block.number
  tx.createdAtTimestamp = event.block.timestamp
  tx.fee = event.params.fee
  tx.hash = hashString
  tx.contractAddress = event.address.toHexString()
  tx.tokenAddress = event.address.toHexString()
  tx.ownerAddress = ownerAddressString
  tx.rateToEth = rateToEth

  tx.save()
}

export function addRedemptionTransaction(event: Redemption): void {
  const hashString = event.transaction.hash.toHexString()
  const ownerAddressString = event.transaction.from.toHexString()
  const id = makeHistoricalEventId(
    hashString,
    ownerAddressString,
    TransactionType.redeem,
    event.transactionLogIndex
  )
  const tx = new Transaction(id)
  const rateToEth = getRateToEth()

  // the amountAfterFee is in terms of Collateral token
  // so we can apply this directly to rateToEth
  const amountBI = event.params.amountAfterFee
    .plus(event.params.fee)
    .times(rateToEth)
    .div(ERC20_DENOMINATORS)

  const amountBD = convertTokenToDecimal(amountBI, BigInt.fromString('18'))

  tx.action = TransactionType.redeem
  tx.amount = amountBD
  tx.createdAtBlockNumber = event.block.number
  tx.createdAtTimestamp = event.block.timestamp
  tx.fee = event.params.fee
  tx.hash = hashString
  tx.contractAddress = event.address.toHexString()
  tx.tokenAddress = event.address.toHexString()
  tx.ownerAddress = ownerAddressString
  tx.rateToEth = rateToEth

  tx.save()
}

export function addUniswapV3SwapTransaction(event: Swap): void {
  const pool = Pool.load(event.address.toHexString())
  if (pool === null) return // impossible

  const longShortToken = Token.load(pool.longShortToken)
  if (!longShortToken) return // impossible

  const hashString = event.transaction.hash.toHexString()
  const ownerAddressString = event.transaction.from.toHexString()
  const rateToEth = getRateToEth()

  const amountInWstEth = pool.collateralTokenPosition.equals(ZERO_BI)
    ? event.params.amount0
    : event.params.amount1

  const action = amountInWstEth.lt(ZERO_BI) ? TransactionType.close : TransactionType.open

  const id = makeHistoricalEventId(
    hashString,
    ownerAddressString,
    action,
    event.transactionLogIndex
  )
  const tx = new Transaction(id)

  const amountBI = amountInWstEth.times(rateToEth).div(ERC20_DENOMINATORS)
  const amountBD = convertTokenToDecimal(amountBI, longShortToken.decimals)

  tx.action = action
  tx.amount = amountBD
  tx.createdAtBlockNumber = event.block.number
  tx.createdAtTimestamp = event.block.timestamp
  tx.fee = ZERO_BI // cant track this yet because uniswap's Swap event doesn't know anything about fees in DepositTradeHelper contract
  tx.hash = hashString
  tx.contractAddress = event.address.toHexString()
  tx.tokenAddress = pool.collateralTokenPosition.equals(ZERO_BI) ? pool.token1 : pool.token0
  tx.ownerAddress = ownerAddressString
  tx.rateToEth = rateToEth

  tx.save()
}
