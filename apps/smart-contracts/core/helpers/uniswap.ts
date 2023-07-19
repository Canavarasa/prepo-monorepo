import { BigNumber } from 'ethers'
import JSBI from 'jsbi'
import { POOL_FEE_TIER } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { MockContract } from '@defi-wonderland/smock'
import { parseEther } from '@ethersproject/units'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { abi as UNIV3_FACTORY_ABI } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import { abi as UNIV3_POOL_ABI } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { abi as SWAP_ROUTER_ABI } from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import { abi as POSITION_MANAGER_ABI } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { abi as QUOTER_ABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { encodeSqrtRatioX96, nearestUsableTick, TickMath, TICK_SPACINGS } from '@uniswap/v3-sdk'
import { findIncreaseLiquidityEvent } from './events'
import {
  Collateral,
  ERC20,
  INonfungiblePositionManager,
  NonfungiblePositionManager,
  SwapRouter,
  UniswapV3Factory,
  UniswapV3Pool,
  Quoter,
} from '../types/generated'
import { IncreaseLiquidityEvent } from '../types/generated/externalArtifacts/INonfungiblePositionManager'

const { nowPlusMonths } = utils

export function attachUniV3Factory(
  ethers: HardhatEthersHelpers,
  address: string
): Promise<UniswapV3Factory> {
  return ethers.getContractAt(UNIV3_FACTORY_ABI, address)
}

export function attachUniV3Pool(
  ethers: HardhatEthersHelpers,
  address: string
): Promise<UniswapV3Pool> {
  return ethers.getContractAt(UNIV3_POOL_ABI, address)
}

export function attachNonfungiblePositionManager(
  ethers: HardhatEthersHelpers,
  address: string
): Promise<NonfungiblePositionManager> {
  return ethers.getContractAt(POSITION_MANAGER_ABI, address)
}

export function attachSwapRouter(
  ethers: HardhatEthersHelpers,
  address: string
): Promise<SwapRouter> {
  return ethers.getContractAt(SWAP_ROUTER_ABI, address)
}

export function attachQuoter(ethers: HardhatEthersHelpers, address: string): Promise<Quoter> {
  return ethers.getContractAt(QUOTER_ABI, address)
}

/**
 * These CLP math helpers are used to convert between the various units used by pools and the
 * Uniswap V3 SDK. The following is an explanation of the 3 types of values encountered:
 *
 * Tick - Ticks are the boundaries between discrete areas in a pool's price space, needed for
 * specifying the range of a liquidity position. Ticks are spaced such that an increase or
 * decrease of 1 tick represents a X% increase or decrease in SqrtX96 price at any point in the
 * price space. This % is defined by the fee tier of the pool (1% in our case). Ticks are represented
 * as an int24 index.
 *
 * SqrtX96 - The square root of the ratio of token1/token0 in a pool. Prices read from the pool
 * and the Uniswap SDK are in this format. The X96 stands for 96 bits reserved for the value after
 * the decimal point. sqrtPriceX96 is stored as a uint160, meaning that there are 160 - 96 = 64
 * integer bits.
 *
 * Wei - This is the price of token0 in terms of token1. We are assuming Collateral is always token1,
 * so when we convert to wei, we are calculating how much Collateral will buy 1 `ether` of Long/Short
 * token. This is useful for when we want to convert a Tick or SqrtX96 to a human readable format.
 *
 * Additional Notes:
 *
 * Liquidity provision will revert if an invalid tick is provided, which is why the nearest valid
 * tick/price must be found/used for the below functions. E.g. If a pool had subsequent valid tick
 * prices of $0.499 and $0.501, then $0.50 would be an invalid tick price.
 */

/**
 * Wei price = sqrtPriceX96 ** 2 / (2 ** 192), derivation taken from
 * https://ethereum.stackexchange.com/questions/98685/computing-the-uniswap-v3-pair-price-from-q64-96-number.
 *
 * This is used for converting SqrtX96 values read from a pool and assumes the price
 * is valid.
 */
export function getWeiFromSqrtX96(sqrtX96Price: BigNumber): BigNumber {
  return sqrtX96Price.pow(2).mul(parseEther('1')).div(BigNumber.from(2).pow(192))
}

/**
 * Takes in a SqrtPriceX96 returned from Uniswap's SDK (which uses a different BigNumber
 * library, JSBI) and converts it to the nearest tick.
 */
export function getNearestTickFromSqrtX96(sqrtX96Price: JSBI): number {
  const tick = TickMath.getTickAtSqrtRatio(sqrtX96Price)
  /**
   * The converted tick might not be a valid tick for the pool,
   * so we must find the nearest tick rather than directly converting to it.
   */
  return nearestUsableTick(tick, TICK_SPACINGS[POOL_FEE_TIER])
}

/**
 * Takes in a price denominated in Collateral wei and converts it to the nearest tick.
 * Needed for determining liquidity ranges to provide across.
 */
export function getNearestTickFromWei(weiPrice: BigNumber): number {
  const sqrtPriceX96 = encodeSqrtRatioX96(weiPrice.toString(), parseEther('1').toString())
  return getNearestTickFromSqrtX96(sqrtPriceX96)
}

/**
 * Takes in a price denominated in Collateral wei and converts it to the nearest
 * SqrtPriceX96. Needed for calculating the starting SqrtPriceX96 to initialize a pool
 * at. Also useful for converting prices read from pools into a format we can use for
 * calculations.
 */
export function getNearestSqrtX96FromWei(weiPrice: BigNumber): BigNumber {
  const sqrtPriceX96 = encodeSqrtRatioX96(weiPrice.toString(), parseEther('1').toString())
  const nearestTick = getNearestTickFromSqrtX96(sqrtPriceX96)
  /**
   * Uniswap's SDK uses a different BigNumber library, so we need to convert it back
   * into BigNumber to use with our existing libraries.
   */
  return BigNumber.from(TickMath.getSqrtRatioAtTick(nearestTick).toString())
}

/**
 * Simulates an `exactInputSingle` swap assuming no slippage protection.
 * Meant for estimating how much will be returned from a swap.
 *
 * `amountOutMinimum` is 0 to represent that we do not care how much is
 * returned since this is just an estimate.
 *
 * `sqrtPriceLimitX96` is 0 since we will not be using price-base slippage
 * protection
 */
export function getAmountOutForExactInputSingle(
  quoter: Quoter,
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: BigNumber,
  fee = POOL_FEE_TIER
): Promise<BigNumber> {
  return quoter.callStatic.quoteExactInputSingle(tokenInAddress, tokenOutAddress, fee, amountIn, 0)
}

/**
 * Simulates an `exactOutputSingle` swap assuming no slippage protection.
 * Meant for estimating how much will be spent on a swap.
 *
 * `amountInMaximum` is the maximum uint256 value to represent that we do
 * not care how much is spent since this is just an estimate.
 *
 * `sqrtPriceLimitX96` is 0 since we will not be using price-base slippage
 * protection
 */
export function getAmountInForExactOutputSingle(
  quoter: Quoter,
  tokenInAddress: string,
  tokenOutAddress: string,
  amountOut: BigNumber,
  fee = POOL_FEE_TIER
): Promise<BigNumber> {
  return quoter.callStatic.quoteExactOutputSingle(
    tokenInAddress,
    tokenOutAddress,
    fee,
    amountOut,
    0
  )
}

export async function getPoolPriceInSqrtX96(
  ethers: HardhatEthersHelpers,
  univ3Factory: UniswapV3Factory,
  token0: string,
  token1: string
): Promise<BigNumber> {
  const poolAddress = await univ3Factory.getPool(token0, token1, POOL_FEE_TIER)
  const pool = await attachUniV3Pool(ethers, poolAddress)
  const slot0 = await pool.slot0()
  return slot0.sqrtPriceX96
}

export async function getPoolPriceInWei(
  ethers: HardhatEthersHelpers,
  univ3Factory: UniswapV3Factory,
  token0: string,
  token1: string
): Promise<BigNumber> {
  const sqrtPriceX96 = await getPoolPriceInSqrtX96(ethers, univ3Factory, token0, token1)
  return getWeiFromSqrtX96(sqrtPriceX96)
}

export async function mintLiquidityForLongShort(
  longShortToken: ERC20,
  collateral: Collateral | MockContract<Collateral>,
  positionManager: NonfungiblePositionManager,
  approxLowerWeiBound: BigNumber,
  approxUpperWeiBound: BigNumber,
  longShortAmount: BigNumber,
  collateralAmount: BigNumber,
  recipient: string,
  funder: SignerWithAddress,
  minLongShortAmount: BigNumber = BigNumber.from(0),
  minCollateralAmount: BigNumber = BigNumber.from(0)
): Promise<IncreaseLiquidityEvent> {
  await longShortToken.connect(funder).approve(positionManager.address, longShortAmount)
  await collateral.connect(funder).approve(positionManager.address, collateralAmount)
  /**
   * The "approxLowerWeiBound" and "approxUpperWeiBound" are prices representing the amount
   * of Collateral needed to purchase 1 "ether" of L/S token at either bound. This is much
   * easier for a dev to reason with than providing ticks or SqrtPrices directly.
   */
  const lowerTick = getNearestTickFromWei(approxLowerWeiBound)
  const upperTick = getNearestTickFromWei(approxUpperWeiBound)
  const params = <INonfungiblePositionManager.MintParamsStruct>{
    token0: longShortToken.address,
    token1: collateral.address,
    fee: POOL_FEE_TIER,
    tickLower: lowerTick,
    tickUpper: upperTick,
    /**
     * The desired amounts to provide might be less than what is actually provided since
     * the pool price might have changed by the time the transaction is mined.
     */
    amount0Desired: longShortAmount,
    amount1Desired: collateralAmount,
    /**
     * Providing minimum amounts will ensure that the transaction will revert if the amount
     * supplied is less than the minimum. These are 0 by default for simplicity during testing,
     * but should be set during production if an exact amount is mandatory.
     */
    amount0Min: minLongShortAmount,
    amount1Min: minCollateralAmount,
    recipient,
    deadline: nowPlusMonths(2),
  }
  await positionManager.connect(funder).mint(params)
  const events = await findIncreaseLiquidityEvent(positionManager)
  return events[0]
}
