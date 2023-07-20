import { calculateValuation } from 'prepo-utils'
import { action, makeObservable } from 'mobx'
import { IconName } from 'prepo-ui'
import { ContractReturn, ContractStore } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { Erc20PermitStore } from './Erc20Permit.entity'
import { UniswapPoolEntity } from './UniswapPoolEntity'
import { UniswapV3PoolHistoricalData } from './UniswapV3PoolHistoricalData'
import { RootStore } from '../RootStore'
import { SupportedContracts } from '../../lib/contract.types'
import {
  Market,
  MarketType,
  MarketVersion,
  NormalizedPoolsData,
  NumberData,
  Range,
  SeparatedMarketHistoryData,
  SupportedMarketID,
} from '../../types/market.types'
import { SupportedMarketTokens } from '../../lib/markets-tokens-contracts'
import { SupportedMarketPools, supportedMarketPools } from '../../lib/markets-pool-contracts'
import {
  PrepoMarketAbi,
  PrepoMarketAbi__factory,
  PrepoMarketV11Abi,
  PrepoMarketV11Abi__factory,
} from '../../../generated/typechain'
import { getContractCall } from '../utils/web3-store-utils'
import { DateTimeInMs } from '../../utils/date-types'
import { getTokenPrice, normalizePoolsData } from '../../utils/market-utils'
import { compactNumber } from '../../utils/number-utils'
import { UnsignedTxOutput } from '../../types/transaction.types'

/** BasePrepoMarketAbi contains all overlapping functions between old PrepoMarket and new PrepoMarket in v1.1 */
export type BasePrepoMarketAbi = PrepoMarketAbi | PrepoMarketV11Abi
type BaseMarketFactory = typeof PrepoMarketAbi__factory | typeof PrepoMarketV11Abi__factory

type GetCeilingLongPayout = BasePrepoMarketAbi['functions']['getCeilingLongPayout']
type GetCeilingValuation = BasePrepoMarketAbi['functions']['getCeilingValuation']
type GetExpiryTime = BasePrepoMarketAbi['functions']['getExpiryTime']
type GetFinalLongPayout = BasePrepoMarketAbi['functions']['getFinalLongPayout']
type GetFloorLongPayout = BasePrepoMarketAbi['functions']['getFloorLongPayout']
type GetFloorValuation = BasePrepoMarketAbi['functions']['getFloorValuation']
type Redeem = BasePrepoMarketAbi['functions']['redeem']

export interface HistoricalData {
  cachedHistoricalData?: SeparatedMarketHistoryData
}

export class BaseMarketEntity
  extends ContractStore<RootStore, SupportedContracts>
  implements Omit<Market, 'static' | 'address'>
{
  type: MarketType
  iconName: IconName
  name: string
  urlId: SupportedMarketID
  companyName: string
  totalSupply?: number = undefined
  long: {
    tokenAddress: SupportedMarketTokens
    poolAddress: SupportedMarketPools
  }
  short: {
    tokenAddress: SupportedMarketTokens
    poolAddress: SupportedMarketPools
  }
  longToken: Erc20PermitStore
  shortToken: Erc20PermitStore
  longPool: UniswapPoolEntity
  shortPool: UniswapPoolEntity
  historicalData: HistoricalData
  version: MarketVersion
  settlementDocsLink?: string

  constructor(public root: RootStore, public data: Market, factory: BaseMarketFactory) {
    super(root, data.address, factory)

    this.iconName = data.iconName
    this.name = data.name
    this.urlId = data.urlId
    this.companyName = data.companyName
    this.long = data.long
    this.short = data.short
    this.type = data.type
    this.totalSupply = data.totalSupply
    this.version = data.version
    this.settlementDocsLink = data.settlementDocsLink

    this.longToken = new Erc20PermitStore({
      root: this.root,
      symbolOverride: `${this.name} Long`,
      tokenName: this.long.tokenAddress,
    })
    this.shortToken = new Erc20PermitStore({
      root: this.root,
      symbolOverride: `${this.name} Short`,
      tokenName: this.short.tokenAddress,
    })

    this.longPool = new UniswapPoolEntity(this.root, this.long.poolAddress)
    this.shortPool = new UniswapPoolEntity(this.root, this.short.poolAddress)

    this.historicalData = new UniswapV3PoolHistoricalData(root, this)

    makeObservable(this, {
      getLongTokenPayout: action.bound,
      getShortTokenPayout: action.bound,
    })
  }

  // region contract calls

  getCeilingLongPayout(
    ...params: Parameters<GetCeilingLongPayout>
  ): ContractReturn<GetCeilingLongPayout> {
    return this.call<GetCeilingLongPayout>('getCeilingLongPayout', params, { subscribe: false })
  }

  getFloorLongPayout(
    ...params: Parameters<GetFloorLongPayout>
  ): ContractReturn<GetFloorLongPayout> {
    return this.call<GetFloorLongPayout>('getFloorLongPayout', params, { subscribe: false })
  }

  getFinalLongPayout(
    ...params: Parameters<GetFinalLongPayout>
  ): ContractReturn<GetFinalLongPayout> {
    return this.call<GetFinalLongPayout>('getFinalLongPayout', params)
  }

  getCeilingValuation(
    ...params: Parameters<GetCeilingValuation>
  ): ContractReturn<GetCeilingValuation> {
    return this.call<GetCeilingValuation>('getCeilingValuation', params, { subscribe: false })
  }

  getFloorValuation(...params: Parameters<GetFloorValuation>): ContractReturn<GetFloorValuation> {
    return this.call<GetFloorValuation>('getFloorValuation', params, { subscribe: false })
  }

  getExpiryTime(...params: Parameters<GetExpiryTime>): ContractReturn<GetExpiryTime> {
    if (this.data.hideExpiry) return undefined
    return this.call<GetExpiryTime>('getExpiryTime', params, { subscribe: false })
  }

  createRedeemTx(...params: Parameters<Redeem>): UnsignedTxOutput {
    if (!this.contract)
      return {
        success: false,
        error: 'Something went wrong, please try again later.',
      }

    const data = this.contract.interface.encodeFunctionData('redeem', params)
    return {
      success: true,
      tx: {
        data,
        to: this.address,
      },
    }
  }

  // endregion

  get ceilingLongPayout(): BigNumber | undefined {
    return this.getCeilingLongPayout()?.[0]
  }

  get floorLongPayout(): BigNumber | undefined {
    return this.getFloorLongPayout()?.[0]
  }

  get finalLongPayout(): BigNumber | undefined {
    return this.getFinalLongPayout()?.[0]
  }

  get payoutRange(): Range | undefined {
    if (this.ceilingLongPayout === undefined || this.floorLongPayout === undefined) return undefined
    return [+formatEther(this.floorLongPayout), +formatEther(this.ceilingLongPayout)]
  }

  get ceilingValuation(): number | undefined {
    const valuation = getContractCall(this.getCeilingValuation())?.toNumber()
    if (valuation === undefined) return undefined
    return valuation * (this.data.valuationMultiplier ?? 1)
  }

  get floorValuation(): number | undefined {
    const valuation = getContractCall(this.getFloorValuation())?.toNumber()
    if (valuation === undefined) return undefined
    return valuation * (this.data.valuationMultiplier ?? 1)
  }

  get valuationRange(): Range | undefined {
    if (this.ceilingValuation === undefined || this.floorValuation === undefined) return undefined
    return [this.floorValuation, this.ceilingValuation]
  }

  get expiryTime(): DateTimeInMs | undefined {
    const expiry = this.getExpiryTime()?.[0]
    if (expiry === undefined) return undefined
    return expiry.mul(1000).toNumber() as DateTimeInMs
  }

  getLongTokenPayout(expectedValuation: number): number | undefined {
    const { floorValuation, ceilingValuation } = this
    if (!floorValuation || !ceilingValuation || !this.payoutRange || !this.longTokenPrice)
      return undefined

    const payoutFloor = this.payoutRange[0]
    const payoutCeil = this.payoutRange[1]

    const top = expectedValuation - floorValuation
    const bottom = ceilingValuation - floorValuation
    const center = top / bottom
    const payout = payoutCeil - payoutFloor
    const longTokenPayout = payoutFloor + center * payout

    return longTokenPayout
  }

  getShortTokenPayout(expectedValuation: number): number | undefined {
    const longTokenPayout = this.getLongTokenPayout(expectedValuation)
    if (!longTokenPayout) return undefined
    return 1 - longTokenPayout
  }

  get longPoolAddress(): string | undefined {
    const { name } = this.root.web3Store.network
    return supportedMarketPools[this.long.poolAddress]?.[name]?.toLocaleLowerCase()
  }

  get shortPoolAddress(): string | undefined {
    const { name } = this.root.web3Store.network
    return supportedMarketPools[this.short.poolAddress]?.[name]?.toLocaleLowerCase()
  }

  get poolsData(): NormalizedPoolsData | undefined {
    if (!this.longPoolAddress || !this.shortPoolAddress) return undefined
    return normalizePoolsData(
      this.root.uniswapV3GraphStore.poolsQuery(this.longPoolAddress, this.shortPoolAddress)
    )
  }

  get finalLongTokenPrice(): number | undefined {
    // final long payout isn't set if it's greater than 1 Ether (1e18)
    if (this.finalLongPayout === undefined || this.finalLongPayout.gt(parseEther('1')))
      return undefined

    return +formatEther(this.finalLongPayout)
  }

  get longTokenPrice(): number | undefined {
    if (this.finalLongTokenPrice !== undefined) return this.finalLongTokenPrice

    if (
      this.longPool?.poolPriceData === undefined ||
      this.longToken?.address === undefined ||
      this.payoutRange === undefined
    )
      return undefined

    const tokenPrice = getTokenPrice(this.longToken.address, this.longPool.poolPriceData)
    if (tokenPrice < this.payoutRange[0]) return 0
    if (tokenPrice > this.payoutRange[1]) return 1
    return tokenPrice
  }

  get shortTokenPrice(): number | undefined {
    if (this.finalLongTokenPrice !== undefined) return 1 - this.finalLongTokenPrice
    if (
      this.shortPool?.poolPriceData === undefined ||
      this.shortToken?.address === undefined ||
      this.payoutRange === undefined
    )
      return undefined
    const tokenPrice = getTokenPrice(this.shortToken.address, this.shortPool.poolPriceData)
    if (tokenPrice < this.payoutRange[0]) return 0
    if (tokenPrice > this.payoutRange[1]) return 1
    return tokenPrice
  }
  /**
   * Get the connection state.
   *
   * @returns {Object} estimatedValuation The estimatedValuation object
   * @returns {number} estimatedValuation.value The complete accurate estimated valuation
   * @returns {number} estimatedValuation.denominated The estimated valuation as denominated value (short value used
   *   for operations)
   */
  get estimatedValuation(): NumberData | undefined {
    const { longTokenPrice, payoutRange, valuationRange } = this
    if (longTokenPrice === undefined || !valuationRange || !payoutRange) return undefined
    const valuation = calculateValuation({ longTokenPrice, payoutRange, valuationRange })
    return { value: valuation }
  }

  get resolved(): boolean {
    return this.finalLongTokenPrice !== undefined
  }

  getUnitPriceString(valuation: number | undefined): string | undefined {
    if (!this.totalSupply || !valuation) return undefined
    return compactNumber(valuation / this.totalSupply, {
      showUsdSign: true,
      minDecimals: 2,
      maxDecimals: 2,
    })
  }
}
