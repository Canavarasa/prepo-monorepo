import { makeAutoObservable } from 'mobx'
import { calculateValuation } from 'prepo-utils'
import getUnixTime from 'date-fns/fp/getUnixTime'
import { BigNumber } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import { UniswapPoolEntity } from './UniswapPoolEntity'
import { Erc20PermitStore } from './Erc20Permit.entity'
import { MarketEntity } from './MarketEntity'
import { Direction } from '../../features/trade/TradeStore'
import { RootStore } from '../RootStore'
import { ERC20_UNITS, WEI_DENOMINATOR } from '../../lib/constants'
import { MarketHistoryData, NumberData } from '../../types/market.types'
import { toPercent } from '../../utils/fraction-utils'

export class PositionEntity {
  constructor(private root: RootStore, public market: MarketEntity, public direction: Direction) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get id(): string {
    return `${this.market.urlId}_${this.direction}`
  }

  get costBasis(): number | undefined {
    const { signerCostBasis } = this.root.portfolioStore
    if (signerCostBasis === undefined || this.token.address === undefined) return undefined

    // find costBasis from subgraph tracked positions
    const costBasis = signerCostBasis[this.token.address?.toLowerCase()]
    return costBasis ?? 0
  }

  get hasPosition(): boolean | undefined {
    if (!this.root.web3Store.connected) return false
    if (this.totalValueInEthBN === undefined || this.totalValueInEth === undefined) return undefined
    return this.totalValueInEthBN.gt(0)
  }

  get pool(): UniswapPoolEntity {
    return this.market[`${this.direction}Pool`]
  }

  get priceInWstEth(): number | undefined {
    return this.market[`${this.direction}TokenPrice`]
  }

  get priceInWstEthBN(): BigNumber | undefined {
    if (this.priceInWstEth === undefined) return undefined
    return parseUnits(`${this.priceInWstEth}`, ERC20_UNITS)
  }

  get priceInEthBN(): BigNumber | undefined {
    if (this.priceInWstEthBN === undefined) return undefined
    return this.root.balancerStore.getWstEthAmountInEth(this.priceInWstEthBN)
  }

  get token(): Erc20PermitStore {
    return this.market[`${this.direction}Token`]
  }

  get totalValueInWstEth(): string | undefined {
    if (this.totalValueInWstEthBN === undefined) return undefined
    return this.token.formatUnits(this.totalValueInWstEthBN)
  }

  get totalValueInEthBN(): BigNumber | undefined {
    if (this.totalValueInWstEthBN === undefined) return undefined
    return this.root.balancerStore.getWstEthAmountInEth(this.totalValueInWstEthBN)
  }

  get totalValueInEth(): string | undefined {
    if (this.totalValueInEthBN === undefined) return undefined
    return this.token.formatUnits(this.totalValueInEthBN)
  }

  get totalValueInWstEthBN(): BigNumber | undefined {
    if (this.token.balanceOfSigner === undefined || this.priceInWstEthBN === undefined)
      return undefined
    return this.token.balanceOfSigner.mul(this.priceInWstEthBN).div(WEI_DENOMINATOR)
  }

  get totalPnl(): number | undefined {
    if (
      this.token.tokenBalanceFormat === undefined ||
      this.priceInWstEth === undefined ||
      this.costBasis === undefined
    )
      return undefined

    return +this.token.tokenBalanceFormat * (this.priceInWstEth - this.costBasis)
  }

  get positionGrowthPercentage(): number | undefined {
    if (this.totalValueInWstEth === undefined || this.totalPnl === undefined) return undefined
    const capital = +this.totalValueInWstEth - this.totalPnl
    if (capital === 0) return 0
    return this.totalPnl / capital
  }

  get longTokenPrice(): number | undefined {
    if (this.priceInWstEth === undefined) return undefined
    return this.direction === 'short' ? 1 - this.priceInWstEth : this.priceInWstEth
  }

  get estimatedValuation(): NumberData | undefined {
    const { payoutRange, valuationRange } = this.market

    if (this.longTokenPrice === undefined || !valuationRange || !payoutRange) return undefined
    const valuation = calculateValuation({
      longTokenPrice: this.longTokenPrice,
      payoutRange,
      valuationRange,
    })
    return { value: valuation }
  }

  get realTimeChartData(): MarketHistoryData[] | undefined {
    if (
      this.market.historicalData?.cachedHistoricalData === undefined ||
      this.estimatedValuation === undefined
    )
      return undefined
    const currentData: MarketHistoryData = {
      timestamp: getUnixTime(new Date()),
      liquidity: 0,
      valuation: this.estimatedValuation.value,
      volume: 0,
    }

    return [...this.market.historicalData.cachedHistoricalData[this.direction], currentData]
  }

  /* executionPrice is the amountForQuote / outputFromQuote */
  getPriceImpact(
    collateralAmount: number,
    lsTokenAmount: number,
    flip = false
  ): number | undefined {
    if (this.pool.feeAsFraction === undefined || this.priceInWstEth === undefined) return undefined
    const fee = toPercent(this.pool.feeAsFraction)
    const inputAmount = flip ? lsTokenAmount : collateralAmount
    const outputAmount = flip ? collateralAmount : lsTokenAmount
    const executionPrice = (inputAmount * (1 - fee)) / outputAmount
    const spotPrice = flip ? 1 / this.priceInWstEth : this.priceInWstEth
    return 1 - spotPrice / executionPrice
  }
}
