import { Address, BigDecimal } from '@graphprotocol/graph-ts'
import { ZERO_BD, ZERO_BI } from './constants'
import { convertTokenToDecimal, safeDiv, sqrtPriceX96ToTokenPrices } from './math'
import { LongShortToken, Pool, Position, Token } from '../generated/types/schema'
import { LongShortToken as LongShortTokenContract } from '../generated/types/templates/UniswapV3Pool/LongShortToken'
import { Swap } from '../generated/types/templates/UniswapV3Pool/UniswapV3Pool'

function updatePoolPrice(event: Swap): Pool | null {
  const pool = Pool.load(event.address.toHexString())
  if (!pool) return null
  const token0ERC20 = Token.load(pool.token0)
  const token1ERC20 = Token.load(pool.token1)

  if (token0ERC20 === null || token1ERC20 === null) return null
  // compute new price
  const prices = sqrtPriceX96ToTokenPrices(
    event.params.sqrtPriceX96,
    token0ERC20.decimals,
    token1ERC20.decimals
  )

  pool.token0Price = prices[0]
  pool.token1Price = prices[1]

  pool.save()
  return pool
}

export function updatePosition(event: Swap): void {
  // make sure this swap is from relevant pool and update token prices
  const pool = updatePoolPrice(event)
  if (pool === null) return

  const ownerAddress = event.transaction.from
  const ownerAddressString = ownerAddress.toHexString()
  const tokenAddressString = pool.longShortToken
  const id = `${tokenAddressString}-${ownerAddressString}`

  let position = Position.load(id)

  if (position === null) {
    position = new Position(id)
    position.ownerAddress = ownerAddressString
    position.longShortToken = tokenAddressString
    position.costBasis = ZERO_BD
  }

  // load all necessary entities
  const longShortToken = LongShortToken.load(tokenAddressString)
  const longShortERC20 = Token.load(tokenAddressString)
  if (longShortToken === null || longShortERC20 === null || pool === null) return

  // fetch user's latest balance
  const tokenContract = LongShortTokenContract.bind(Address.fromString(tokenAddressString))
  const balance = tokenContract.balanceOf(ownerAddress)

  // find the long short token amount that was bought or sold
  const amount = pool.collateralTokenPosition.equals(ZERO_BI)
    ? event.params.amount1
    : event.params.amount0

  // since this is a Swap event from pool, a positive amount means user is closing a position (deposit long/short token to pool)
  // closing a position does not change the cost basis
  if (amount.ge(ZERO_BI)) return

  // convert balance to BigDecimal so we can compute the weight with the price, which is in BigDecimal
  const balanceBD = convertTokenToDecimal(balance, longShortERC20.decimals)
  // we have to negate amount
  const amountBD = ZERO_BD.minus(convertTokenToDecimal(amount, longShortERC20.decimals))
  const prevBalanceBD = balanceBD.minus(amountBD)

  // get the latest price from pool
  const priceInWstEth = pool.collateralTokenPosition.equals(ZERO_BI)
    ? pool.token0Price
    : pool.token1Price

  // get price excluding fee
  const feeDenominator = BigDecimal.fromString('1000000')
  const percentageAfterFee = feeDenominator.plus(pool.fee.toBigDecimal())
  const priceWithoutFee = priceInWstEth.times(feeDenominator).div(percentageAfterFee)

  // newCostBasis = ((prevBalance * oldCostBasis) + (boughtAmount * latestPrice)) / (curBal + boughtAmount)
  const oldWeight = prevBalanceBD.times(position.costBasis)
  const newWeight = amountBD.times(priceWithoutFee)
  const totalWeight = oldWeight.plus(newWeight)
  const costBasis = safeDiv(totalWeight, balanceBD)

  position.costBasis = costBasis
  position.save()
}
