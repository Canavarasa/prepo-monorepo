import { makeObservable } from 'mobx'
import { BaseMarketEntity } from './BaseMarketEntity'
import { UniswapV3PoolHistoricalData } from './UniswapV3PoolHistoricalData'
import { RootStore } from '../RootStore'
import { Market, NumberData } from '../../types/market.types'
import { PrepoMarketAbi__factory } from '../../../generated/typechain'
import { getTotalValueLockedUSD } from '../../utils/market-utils'

export class MarketEntity extends BaseMarketEntity {
  constructor(root: RootStore, data: Market) {
    super(root, data, PrepoMarketAbi__factory)
    makeObservable(this, {})
  }

  get liquidity(): NumberData | undefined {
    if (
      this.poolsData === undefined ||
      this.root.collateralStore.address === undefined ||
      this.payoutRange === undefined
    )
      return undefined
    const { longTokenPool, shortTokenPool } = this.poolsData
    const longLiquidity = getTotalValueLockedUSD(
      longTokenPool,
      this.payoutRange,
      this.root.collateralStore.address
    )
    const shortLiquidity = getTotalValueLockedUSD(
      shortTokenPool,
      this.payoutRange,
      this.root.collateralStore.address
    )
    const value = longLiquidity + shortLiquidity
    return { value }
  }
}
