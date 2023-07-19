import { action, computed, makeAutoObservable, observable } from 'mobx'
import { RootStore } from './RootStore'
import { MarketEntity } from './entities/MarketEntity'
import { MarketEntityV1_1 } from './entities/MarketEntityV1_1'
import { BaseMarketEntity } from './entities/BaseMarketEntity'
import { markets } from '../lib/markets'
import { Market } from '../types/market.types'

const makeMarketEntity = (root: RootStore, market: Market): BaseMarketEntity => {
  switch (market.version) {
    case 'v1.1':
      return new MarketEntityV1_1(root, market)
    default:
      return new MarketEntity(root, market)
  }
}

export class MarketStore {
  root: RootStore
  markets: {
    [key: string]: MarketEntity
  } = {}
  searchQuery: string

  constructor(root: RootStore) {
    this.root = root
    this.searchQuery = ''
    this.markets = markets.reduce(
      (value, market) => ({
        ...value,
        [market.urlId]: makeMarketEntity(this.root, market),
      }),
      {}
    )
    makeAutoObservable(this, {
      searchQuery: observable,
      setSearchQuery: action.bound,
      unresolvedMarkets: computed,
    })
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query
  }

  get unresolvedMarkets(): MarketEntity[] {
    return Object.values(this.markets).filter((market) => !market.resolved)
  }
}
