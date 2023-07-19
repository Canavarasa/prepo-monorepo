import { makeAutoObservable } from 'mobx'
import { MarketEntity } from '../../stores/entities/MarketEntity'
import { PositionEntity } from '../../stores/entities/Position.entity'
import { RootStore } from '../../stores/RootStore'
import { ChartTimeframe } from '../../types/market.types'
import { makeQueryString } from '../../utils/makeQueryString'

export type Direction = 'long' | 'short'
export type TradeAction = 'open' | 'close'
type SlideUpContent = 'OpenMarket' | 'OpenCurrency' | 'ClosePosition' | 'CloseCurrency'

export class TradeStore {
  action: TradeAction = 'open'
  direction: Direction = 'long'
  private userSelectedMarket?: MarketEntity
  private simulatorOpen = false
  slideUpContent?: SlideUpContent = undefined
  selectedTimeframe: ChartTimeframe = ChartTimeframe.DAY

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setAction(action: TradeAction): string {
    this.root.closeTradeStore.reset()
    this.action = action
    return this.tradeUrl
  }

  setSlideUpContent(slideUpContent?: SlideUpContent): void {
    this.slideUpContent = slideUpContent
  }

  setDirection(direction: Direction): string {
    this.root.openTradeStore.reset()
    this.root.closeTradeStore.reset()
    this.direction = direction
    return this.tradeUrl
  }

  setSelectedMarket(marketUrlId?: string): string {
    this.root.closeTradeStore.reset()
    this.root.closeTradeStore.reset()
    if (!marketUrlId) {
      this.userSelectedMarket = undefined
      return this.tradeUrl
    }
    const market = this.root.marketStore.markets[marketUrlId]
    this.userSelectedMarket = market
    return this.tradeUrl
  }

  setSelectedTimeframe(timeframe: ChartTimeframe): void {
    this.selectedTimeframe = timeframe
  }

  get tradeUrl(): string {
    return makeQueryString({
      marketId: this.selectedMarket?.urlId,
      direction: this.direction,
      action: this.action,
    })
  }

  get selectedMarket(): MarketEntity | undefined {
    const { unresolvedMarkets = [] } = this.root.marketStore
    const onlyMarket = unresolvedMarkets.length === 1 ? unresolvedMarkets[0] : undefined

    if (this.action === 'close') return this.userSelectedMarket

    return this.userSelectedMarket ?? onlyMarket
  }

  get selectedPosition(): PositionEntity | undefined {
    const { allPositions } = this.root.portfolioStore
    if (!this.direction || !this.selectedMarket) return undefined

    const position = allPositions.find(
      ({ direction, market }) =>
        direction === this.direction && this.selectedMarket?.urlId === market.urlId
    )

    return position
  }

  toggleSimulatorOpen(): void {
    this.simulatorOpen = !this.simulatorOpen
  }

  get showSimulator(): boolean {
    if (this.action === 'close' && !this.selectedPosition?.hasPosition) return false
    return this.simulatorOpen && this.selectedMarket !== undefined && !this.selectedMarket.resolved
  }

  get showSimulatorButton(): boolean {
    if (this.action === 'close' && !this.selectedPosition?.hasPosition) return false
    return this.selectedMarket !== undefined && !this.selectedMarket.resolved && !this.showSimulator
  }
}
