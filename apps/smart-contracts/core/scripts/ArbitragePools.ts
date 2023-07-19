import { parseEther } from '@ethersproject/units'
import { BigNumber, Contract, ethers, Signer } from 'ethers'
import IArbitrageBrokerArtifact from './exportedArtifacts/ArbitrageBroker.json'
import IERC20Artifact from './exportedArtifacts/IERC20.json'
import IPrePOMarketArtifact from './exportedArtifacts/IPrePOMarket.json'
import IUniswapV3FactoryArtifact from './exportedArtifacts/IUniswapV3Factory.json'
import IUniswapV3PoolArtifact from './exportedArtifacts/IUniswapV3Pool.json'

/**
 * TODO: Write an error handling wrapper that is able to differentiate between
 * failure due to an unresponsive relayer or RPC (e.g. Infura) versus failure
 * because of an invalid transaction/contract call.
 */

const UNIV3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const POOL_FEE_TIER = 10000

// Taken from helpers/uniswap.ts
const getWeiFromSqrtX96 = (sqrtX96Price: BigNumber): BigNumber =>
  sqrtX96Price.pow(2).mul(ethers.utils.parseEther('1')).div(BigNumber.from(2).pow(192))

/* eslint-disable no-promise-executor-return */
export const sleep = (delay: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delay))

export type MarketTokens = {
  longToken: Contract
  shortToken: Contract
}

export type MarketPools = {
  longPool: Contract
  shortPool: Contract
}

export type PoolPrices = {
  longPoolPrice: BigNumber
  shortPoolPrice: BigNumber
}

/**
 * Output/input amounts returned from swap estimates are optional
 * since we are not limited by solidity and can utilize optional
 * return values to have precisely named return values for both
 * arbitrage strategies.
 */
export type ArbitrageEstimate = {
  tradeSize: BigNumber
  profit: BigNumber
  collateralToBuyLong?: BigNumber
  collateralToBuyShort?: BigNumber
  collateralFromSellingLong?: BigNumber
  collateralFromSellingShort?: BigNumber
}

export enum ArbitrageStrategy {
  'BUY_AND_REDEEM',
  'MINT_AND_SELL',
  'INSUFFICIENT_SPREAD',
}

/**
 * Define attach fixture here specifically to instantiate instances
 * using only base ethers.js and an ABI.
 */
export const attachArbitrageBroker = (
  provider: ethers.providers.BaseProvider,
  arbitrageBrokerAddress: string
): Contract => new ethers.Contract(arbitrageBrokerAddress, IArbitrageBrokerArtifact.abi, provider)

export const attachERC20 = (
  provider: ethers.providers.BaseProvider,
  erc20Address: string
): Contract => new ethers.Contract(erc20Address, IERC20Artifact.abi, provider)

export const attachMarket = (
  provider: ethers.providers.BaseProvider,
  marketAddress: string
): Contract => new ethers.Contract(marketAddress, IPrePOMarketArtifact.abi, provider)

export const attachPool = (
  provider: ethers.providers.BaseProvider,
  poolAddress: string
): Contract => new ethers.Contract(poolAddress, IUniswapV3PoolArtifact.abi, provider)

export const attachPoolFactory = (
  provider: ethers.providers.BaseProvider,
  factoryAddress: string
): Contract => new ethers.Contract(factoryAddress, IUniswapV3FactoryArtifact.abi, provider)

export const getTokensFromMarket = async (
  provider: ethers.providers.BaseProvider,
  marketAddress: string
): Promise<MarketTokens> => {
  const market = attachMarket(provider, marketAddress)
  const longTokenAddress = await market.getLongToken()
  const shortTokenAddress = await market.getShortToken()
  const longToken = attachERC20(provider, longTokenAddress)
  const shortToken = attachERC20(provider, shortTokenAddress)
  return { longToken, shortToken }
}

export const getPoolsFromTokens = async (
  provider: ethers.providers.BaseProvider,
  collateralAddress: string,
  longTokenAddress: string,
  shortTokenAddress: string
): Promise<MarketPools> => {
  const factory = attachPoolFactory(provider, UNIV3_FACTORY)
  const longPoolAddress = await factory.getPool(longTokenAddress, collateralAddress, POOL_FEE_TIER)
  const shortPoolAddress = await factory.getPool(
    shortTokenAddress,
    collateralAddress,
    POOL_FEE_TIER
  )
  const longPool = attachPool(provider, longPoolAddress)
  const shortPool = attachPool(provider, shortPoolAddress)
  return { longPool, shortPool }
}

export const getWeiPricesFromPools = async (marketPools: MarketPools): Promise<PoolPrices> => {
  const longPoolSlot0 = await marketPools.longPool.slot0()
  const shortPoolSlot0 = await marketPools.shortPool.slot0()
  const longPoolPrice = getWeiFromSqrtX96(longPoolSlot0.sqrtPriceX96)
  const shortPoolPrice = getWeiFromSqrtX96(shortPoolSlot0.sqrtPriceX96)
  return { longPoolPrice, shortPoolPrice }
}

export const getStrategyToUse = (
  longPoolWeiPrice: BigNumber,
  shortPoolWeiPrice: BigNumber,
  minStartingSpread: BigNumber
): ArbitrageStrategy => {
  const combinedPriceInWei = longPoolWeiPrice.add(shortPoolWeiPrice)
  if (combinedPriceInWei.lt(ethers.utils.parseEther('1').sub(minStartingSpread))) {
    return ArbitrageStrategy.BUY_AND_REDEEM
  }
  if (combinedPriceInWei.gt(ethers.utils.parseEther('1').add(minStartingSpread))) {
    return ArbitrageStrategy.MINT_AND_SELL
  }
  /**
   * TODO when testing with real relayer, add OZ notification containing
   * the spread amount when spread is insufficient.
   */
  return ArbitrageStrategy.INSUFFICIENT_SPREAD
}

export const nowPlusSeconds = (seconds: number): number => {
  const d = new Date()
  return Math.floor(d.getTime() / 1000 + seconds)
}

export const getEstimateGivenTradeSize = async (
  arbitrageStrategy: ArbitrageStrategy,
  arbitrageBroker: Contract,
  marketAddress: string,
  currentTradeSize: BigNumber
): Promise<ArbitrageEstimate> => {
  if (arbitrageStrategy === ArbitrageStrategy.BUY_AND_REDEEM) {
    /**
     * 10 seconds as a deadline to ensure estimate goes through
     * even if there is some latency with a provider.
     *
     * Using MaxUint256 for slippage parameters since we are
     * buying L/S tokens and do not care about slippage for an
     * estimate.
     */
    const tradeParamsForEstimation = {
      deadline: nowPlusSeconds(10),
      longShortAmount: currentTradeSize,
      collateralLimitForLong: ethers.constants.MaxUint256,
      collateralLimitForShort: ethers.constants.MaxUint256,
    }
    /**
     * Return all values returned by estimate, since once we
     * identify the ideal position size, we can immediately
     * move on to calculating slippage parameters.
     */
    const estimate = await arbitrageBroker.callStatic.buyAndRedeem(
      marketAddress,
      tradeParamsForEstimation
    )
    return {
      tradeSize: currentTradeSize,
      profit: estimate.profit,
      collateralToBuyLong: estimate.collateralToBuyLong,
      collateralToBuyShort: estimate.collateralToBuyShort,
    }
  }
  if (arbitrageStrategy === ArbitrageStrategy.MINT_AND_SELL) {
    /**
     * Using 0 for slippage parameters since we are selling L/S
     * tokens and do not care about slippage for an estimate.
     */
    const tradeParamsForEstimation = {
      deadline: nowPlusSeconds(10),
      longShortAmount: currentTradeSize,
      collateralLimitForLong: 0,
      collateralLimitForShort: 0,
    }
    const estimate = await arbitrageBroker.callStatic.mintAndSell(
      marketAddress,
      tradeParamsForEstimation
    )
    return {
      tradeSize: currentTradeSize,
      profit: estimate.profit,
      collateralFromSellingLong: estimate.collateralFromSellingLong,
      collateralFromSellingShort: estimate.collateralFromSellingShort,
    }
  }
  /**
   * We want to throw an error here since this should never happen.
   * If an INSUFFICIENT_SPREAD is detected, we should skip position
   * sizing altogether and move to the next market.
   */
  throw new Error('Cannot get estimate for INSUFFICIENT_SPREAD')
}

/**
 * `maxSlippage` is a string because BigNumber does not support decimal
 * inputs for calculations. Instead, we convert a float string,
 * e.g. '0.05'(5%), to a 18 decimal factor.
 */
export const getSlippageFactor = (
  arbitrageStrategy: ArbitrageStrategy,
  maxSlippage: string
): BigNumber => {
  if (parseEther(maxSlippage).lt(0)) {
    throw new Error('Invalid slippage factor')
  }
  if (arbitrageStrategy === ArbitrageStrategy.BUY_AND_REDEEM) {
    /**
     * The slippage factor applied is 100% + maxSlippage, since we want
     * to limit the cost of buying L/S tokens.
     */
    return parseEther('1').add(parseEther(maxSlippage))
  }
  if (arbitrageStrategy === ArbitrageStrategy.MINT_AND_SELL) {
    /**
     * The slippage factor applied is 100% - maxSlippage, since we want
     * to put a floor on the proceeds from selling L/S tokens.
     */
    if (parseEther(maxSlippage).gt(parseEther('1'))) {
      throw new Error('Invalid slippage factor')
    }
    return parseEther('1').sub(parseEther(maxSlippage))
  }
  throw new Error('Cannot get estimate for INSUFFICIENT_SPREAD')
}

/**
 * `gasCostBuffer` is the Collateral-denominated gas fee to be accounted
 * for e.g. 1 ether would be 1 Collateral in gas cost buffer
 */
export const getAdjustedEstimate = (
  arbitrageStrategy: ArbitrageStrategy,
  estimate: ArbitrageEstimate,
  gasCostBuffer: BigNumber,
  maxSlippage: string
): ArbitrageEstimate => {
  if (arbitrageStrategy === ArbitrageStrategy.BUY_AND_REDEEM) {
    const slippageFactor = getSlippageFactor(arbitrageStrategy, maxSlippage)
    const adjustedCollateralToBuyLong = estimate.collateralToBuyLong
      .mul(slippageFactor)
      .div(parseEther('1'))
    const adjustedCollateralToBuyShort = estimate.collateralToBuyShort
      .mul(slippageFactor)
      .div(parseEther('1'))
    return {
      tradeSize: estimate.tradeSize,
      /**
       * Profit is L/S amount bought for redemption (trade size) minus
       * adjusted cost and gas cost buffer.
       */
      profit: estimate.tradeSize
        .sub(adjustedCollateralToBuyLong)
        .sub(adjustedCollateralToBuyShort)
        .sub(gasCostBuffer),
      // Pass along adjusted costs to use as slippage parameters
      collateralToBuyLong: adjustedCollateralToBuyLong,
      collateralToBuyShort: adjustedCollateralToBuyShort,
    }
  }
  if (arbitrageStrategy === ArbitrageStrategy.MINT_AND_SELL) {
    const slippageFactor = parseEther('1').sub(parseEther(maxSlippage))
    const adjustedCollateralFromSellingLong = estimate.collateralFromSellingLong
      .mul(slippageFactor)
      .div(parseEther('1'))
    const adjustedCollateralFromSellingShort = estimate.collateralFromSellingShort
      .mul(slippageFactor)
      .div(parseEther('1'))
    return {
      tradeSize: estimate.tradeSize,
      /**
       * Profit is adjusted proceeds minus L/S amount minted to be sold
       * (trade size) and gas cost buffer.
       */
      profit: adjustedCollateralFromSellingLong
        .add(adjustedCollateralFromSellingShort)
        .sub(estimate.tradeSize)
        .sub(gasCostBuffer),
      // Pass along adjusted proceeds to use as slippage parameters
      collateralFromSellingLong: adjustedCollateralFromSellingLong,
      collateralFromSellingShort: adjustedCollateralFromSellingShort,
    }
  }
  throw new Error('Cannot get estimate for INSUFFICIENT_SPREAD')
}

/**
 * `growthFactor` is a string because BigNumber does not support decimal
 * inputs for calculations. Instead, we convert a float string,
 * e.g. '1.05'(1.05x), to a 18 decimal factor.
 */
export const getNextTradeSize = (currentTradeSize: BigNumber, growthFactor: string): BigNumber => {
  if (parseEther(growthFactor).lte(parseEther('1'))) {
    throw new Error('Invalid growth factor')
  }
  return currentTradeSize.mul(parseEther(growthFactor)).div(parseEther('1'))
}

export const getIdealTradeSize = async (
  initialSize: BigNumber,
  maxTradeSize: BigNumber,
  arbitrageStrategy: ArbitrageStrategy,
  arbitrageBroker: Contract,
  marketAddress: string,
  gasCostBuffer: BigNumber,
  maxSlippage: string,
  growthFactor: string
): Promise<ArbitrageEstimate> => {
  let currentTradeSize = initialSize
  let previousEstimate: ArbitrageEstimate = {
    tradeSize: BigNumber.from(0),
    profit: BigNumber.from(0),
  }
  /* eslint-disable no-await-in-loop */
  while (currentTradeSize.lte(maxTradeSize)) {
    const unadjustedEstimate = await getEstimateGivenTradeSize(
      arbitrageStrategy,
      arbitrageBroker,
      marketAddress,
      currentTradeSize
    )
    const adjustedEstimate = getAdjustedEstimate(
      arbitrageStrategy,
      unadjustedEstimate,
      gasCostBuffer,
      maxSlippage
    )
    if (adjustedEstimate.profit.lt(previousEstimate.profit)) break
    previousEstimate = adjustedEstimate
    currentTradeSize = getNextTradeSize(currentTradeSize, growthFactor)
  }
  return previousEstimate
}

export const executeTrade = async (
  signer: Signer,
  arbitrageStrategy: ArbitrageStrategy,
  arbitrageBroker: Contract,
  marketAddress: string,
  estimate: ArbitrageEstimate
): Promise<void> => {
  const deadline = nowPlusSeconds(10)
  if (arbitrageStrategy === ArbitrageStrategy.BUY_AND_REDEEM) {
    const tx = await arbitrageBroker.connect(signer).buyAndRedeem(marketAddress, {
      deadline,
      longShortAmount: estimate.tradeSize,
      collateralLimitForLong: estimate.collateralToBuyLong,
      collateralLimitForShort: estimate.collateralToBuyShort,
    })
    await tx.wait()
  } else if (arbitrageStrategy === ArbitrageStrategy.MINT_AND_SELL) {
    const tx = await arbitrageBroker.connect(signer).mintAndSell(marketAddress, {
      deadline,
      longShortAmount: estimate.tradeSize,
      collateralLimitForLong: estimate.collateralFromSellingLong,
      collateralLimitForShort: estimate.collateralFromSellingShort,
    })
    await tx.wait()
  } else {
    throw new Error('Cannot execute trade for INSUFFICIENT_SPREAD')
  }
}

export const executeTradeIfProfitable = async (
  signer: Signer,
  arbitrageStrategy: ArbitrageStrategy,
  arbitrageBroker: Contract,
  marketAddress: string,
  estimate: ArbitrageEstimate,
  minNetProfit: BigNumber,
  delay: number
): Promise<void> => {
  if (estimate.profit.gte(minNetProfit))
    await executeTrade(signer, arbitrageStrategy, arbitrageBroker, marketAddress, estimate)
  await sleep(delay)
}

export const arbitragePools = async (
  provider: ethers.providers.BaseProvider,
  signer: Signer,
  collateralAddress: string,
  arbitrageBrokerAddress: string,
  markets: string[],
  minStartingSpread: BigNumber,
  minNetProfit: BigNumber,
  initialSize: BigNumber,
  gasCostBuffer: BigNumber,
  maxSlippage: string,
  growthFactor: string,
  delay: number
): Promise<void> => {
  const collateral = attachERC20(provider, collateralAddress)
  const arbitrageBroker = attachArbitrageBroker(provider, arbitrageBrokerAddress)
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < markets.length; i++) {
    const marketAddress = markets[i]
    const marketTokens = await getTokensFromMarket(provider, marketAddress)
    const marketPools = await getPoolsFromTokens(
      provider,
      collateralAddress,
      marketTokens.longToken.address,
      marketTokens.shortToken.address
    )
    const marketWeiPrices = await getWeiPricesFromPools(marketPools)
    const strategyToUse = getStrategyToUse(
      marketWeiPrices.longPoolPrice,
      marketWeiPrices.shortPoolPrice,
      minStartingSpread
    )
    const maxTradeSize = await collateral.balanceOf(arbitrageBroker.address)
    const idealTradeSize = await getIdealTradeSize(
      initialSize,
      maxTradeSize,
      strategyToUse,
      arbitrageBroker,
      marketAddress,
      gasCostBuffer,
      maxSlippage,
      growthFactor
    )
    await executeTradeIfProfitable(
      signer,
      strategyToUse,
      arbitrageBroker,
      marketAddress,
      idealTradeSize,
      minNetProfit,
      delay
    )
  }
}
