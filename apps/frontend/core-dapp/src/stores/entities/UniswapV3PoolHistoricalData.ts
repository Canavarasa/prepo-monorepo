import { makeAutoObservable, reaction, runInAction } from 'mobx'
import { SEC_IN_MS } from 'prepo-constants'
import { BaseMarketEntity } from './BaseMarketEntity'
import { RootStore } from '../RootStore'
import {
  ChartTimeframe,
  FormatPoolsHistoricalDatasOptions,
  HistoricalDataQueryType,
  PoolsDayDatas,
  PoolsHourDatas,
  SeparatedMarketHistoryData,
} from '../../types/market.types'
import { DateRange } from '../../types/general.types'
import {
  formatMarketHistoricalData,
  normalizePoolsDayDatas,
  normalizePoolsHourDatas,
  syncPoolsData,
} from '../../utils/market-utils'
import { PROJECT_START_TIMESTAMP } from '../../lib/constants'
import {
  getDateRangeFromDays,
  getDateRangeFromHours,
  getDaysFromDateRange,
  getEndOfHour,
  getHoursFromDateRange,
  getStartOfHour,
  getUTCEndOfDay,
  getUTCStartOfDay,
} from '../../utils/date-utils'
import { UNISWAP_MAX_DATAPOINTS } from '../graphs/UniswapV3GraphStore'

const timeframeMap = {
  [ChartTimeframe.DAY]: 24,
  [ChartTimeframe.WEEK]: 168,
  [ChartTimeframe.MONTH]: 720,
  [ChartTimeframe.YEAR]: 8760,
  [ChartTimeframe.ALL]: UNISWAP_MAX_DATAPOINTS * 24,
}

const getProjectStartedHours = (): number => {
  const now = new Date().getTime()
  const projectStartTimeInMs = PROJECT_START_TIMESTAMP * SEC_IN_MS
  return getHoursFromDateRange({ endTimeInMs: now, startTimeInMs: projectStartTimeInMs })
}

/**
 * Handles caching historical data of a market:
 * The UniswapV3GraphStore exposes 2 functions for each timeframe - one to get historical data and one to get latest data
 * It is designed this way to allow fetching the latest data every block without having to refetch the entire historical data
 * Because fetching the entire historical data is both computationally expensive and slow
 *
 * This store handles caching historical data, so we don't have to refetch them when timeframe is switched,
 * and intelligently subscribe to latest data of the selected timeframe
 */
export class UniswapV3PoolHistoricalData {
  cachedTimeframe = ChartTimeframe.DAY
  cachedHistoricalData?: SeparatedMarketHistoryData
  constructor(private root: RootStore, public market: BaseMarketEntity) {
    makeAutoObservable(this, {}, { autoBind: true })
    this.cacheHistoricalData()
  }

  /** Cache historical data, so we don't have to refetch them when timeframe is switched
   * e.g. without caching, if 1D is selected, then 1W, then 1D again, we'd have to refetch 1D data
   */

  cacheHistoricalData(): void {
    reaction(
      () => ({
        historicalData: this.historicalData,
        selectedTimeframe: this.root.tradeStore.selectedTimeframe ?? this.cachedTimeframe,
      }),
      ({ historicalData, selectedTimeframe }) => {
        runInAction(() => {
          const loaded = historicalData.long !== undefined && historicalData.short !== undefined

          // allow showing loading UI if timeframe is changed
          // will be undefined if data hasn't been cached for that timeframe
          if (selectedTimeframe !== this.cachedTimeframe)
            this.cachedHistoricalData = loaded
              ? (historicalData as SeparatedMarketHistoryData)
              : undefined

          // never allow showing loading UI if timeframe hasn't been changed,
          // this will happen when an hour/day is passed and GraphStore cache no longer works with the previous hour/day timestamp keys
          if (selectedTimeframe === this.cachedTimeframe && loaded)
            this.cachedHistoricalData = historicalData as SeparatedMarketHistoryData

          this.cachedTimeframe = selectedTimeframe
        })
      }
    )
  }

  getDataByPeriod(
    { endTimeInMs, startTimeInMs }: DateRange,
    intervals: number,
    type: HistoricalDataQueryType
  ): SeparatedMarketHistoryData | undefined {
    if (!this.market.longPoolAddress || !this.market.shortPoolAddress || !this.formatPoolsOptions)
      return undefined
    const queryCall =
      type === HistoricalDataQueryType.DAY ? 'historicalDailyData' : 'historicalHourlyData'
    const data = this.root.uniswapV3GraphStore[queryCall](
      this.market.longPoolAddress,
      this.market.shortPoolAddress,
      endTimeInMs,
      intervals
    )

    if (!data) return undefined
    const normalize =
      type === HistoricalDataQueryType.DAY ? normalizePoolsDayDatas : normalizePoolsHourDatas

    return formatMarketHistoricalData(normalize(data as PoolsDayDatas & PoolsHourDatas), {
      ...this.formatPoolsOptions,
      startTimeInMs,
      endTimeInMs,
      type,
    })
  }

  getHistoricalData({ endTimeInMs, startTimeInMs }: Partial<DateRange> = {}): {
    data: SeparatedMarketHistoryData | undefined
    type: HistoricalDataQueryType
  } {
    const projectStartTimeInMs = PROJECT_START_TIMESTAMP * SEC_IN_MS

    const end = getEndOfHour(endTimeInMs ?? new Date().getTime()) + 1
    const start = getStartOfHour(startTimeInMs ?? projectStartTimeInMs)

    let selectedIntervals = getHoursFromDateRange({ endTimeInMs: end, startTimeInMs: start })
    let selectedStartTime = start
    let selectedEndTime = end
    let type = HistoricalDataQueryType.HOUR

    // handles if selected hours is more than uniswap subgraph can handle
    if (selectedIntervals > UNISWAP_MAX_DATAPOINTS) {
      const endDay = getUTCEndOfDay(end) + 1
      let startDay = getUTCStartOfDay(start)

      selectedIntervals = getDaysFromDateRange({
        endTimeInMs: endDay,
        startTimeInMs: startDay,
      })

      if (selectedIntervals > UNISWAP_MAX_DATAPOINTS) {
        selectedIntervals = UNISWAP_MAX_DATAPOINTS
        startDay = getDateRangeFromDays(selectedIntervals, endDay).startTimeInMs
      }

      selectedStartTime = startDay
      selectedEndTime = endDay
      type = HistoricalDataQueryType.DAY
    }

    return {
      data: this.getDataByPeriod(
        { endTimeInMs: selectedEndTime, startTimeInMs: selectedStartTime },
        selectedIntervals,
        type
      ),
      type,
    }
  }

  getLatestPoolsData(type: HistoricalDataQueryType): SeparatedMarketHistoryData | undefined {
    if (!this.market.longPoolAddress || !this.market.shortPoolAddress || !this.formatPoolsOptions)
      return undefined
    const queryCall = type === HistoricalDataQueryType.DAY ? 'poolsDayDatas' : 'poolsHourDatas'
    const data = this.root.uniswapV3GraphStore[queryCall](
      this.market.longPoolAddress,
      this.market.shortPoolAddress
    )
    if (!data) return undefined
    const normalize =
      type === HistoricalDataQueryType.DAY ? normalizePoolsDayDatas : normalizePoolsHourDatas
    return formatMarketHistoricalData(normalize(data as PoolsDayDatas & PoolsHourDatas), {
      ...this.formatPoolsOptions,
      type,
    })
  }

  get formatPoolsOptions():
    | Omit<FormatPoolsHistoricalDatasOptions, 'endTimeInMs' | 'startTimeInMs' | 'type'>
    | undefined {
    const { longToken, payoutRange, shortToken, valuationRange } = this.market
    if (
      longToken?.address !== undefined &&
      shortToken?.address !== undefined &&
      payoutRange &&
      valuationRange
    ) {
      const tokenAddresses = { long: longToken.address, short: shortToken.address }
      return { tokenAddresses, payoutRange, valuationRange }
    }
    return undefined
  }

  get historicalDataDateRange(): DateRange {
    return getDateRangeFromHours(
      Math.min(getProjectStartedHours(), timeframeMap[this.root.tradeStore.selectedTimeframe])
    )
  }

  get historicalData(): Partial<SeparatedMarketHistoryData> {
    const { data, type } = this.getHistoricalData(this.historicalDataDateRange)
    if (data === undefined) return {}
    return syncPoolsData(data, type, this.getLatestPoolsData(type))
  }
}
