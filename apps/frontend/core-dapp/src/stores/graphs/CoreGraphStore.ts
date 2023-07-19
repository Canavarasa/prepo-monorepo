import { GRAPH_ENDPOINTS } from 'prepo-constants'
import { makeAutoObservable } from 'mobx'
import { Query, createHttpClient } from 'mst-gql'
import { getContractAddress } from 'prepo-utils'
import { RootStore } from '../RootStore'
import {
  KNOWN_HISTORY_EVENTS,
  KNOWN_HISTORY_EVENTS_MAP,
} from '../../features/history/history-utils'
import { RootStoreBase } from '../../../generated/mst-gql/core-dapp/RootStore.base'
import { FilterType } from '../../components/Filter/filter.constants'
import { supportedContracts } from '../../lib/supported-contracts'
import { SubgraphErrorPolicy } from '../../../generated/mst-gql/uniswap-v3'
import {
  OrderDirection,
  PositionModelType,
  TransactionModelType,
  TransactionOrderBy,
} from '../../../generated/mst-gql/core-dapp'

export type Position = Pick<PositionModelType, 'id' | 'costBasis' | 'ownerAddress'> & {
  longShortToken: Pick<PositionModelType['longShortToken'], 'id'>
}

export class CoreGraphStore {
  queryStore: typeof RootStoreBase.Type
  constructor(private root: RootStore) {
    this.queryStore = RootStoreBase.create(undefined, {
      gqlHttpClient: createHttpClient(GRAPH_ENDPOINTS.core.arbitrumOne as string),
      ssr: true,
    })

    makeAutoObservable(this)
  }

  positionsQuery(address: string): Query<{
    positions: Position[]
  }> {
    return this.queryStore.queryPositions(
      {
        where: { ownerAddress: address.toLowerCase() },
        subgraphError: SubgraphErrorPolicy.deny,
      },
      (selector) => selector.id.costBasis.ownerAddress.longShortToken(({ id }) => id)
    )
  }

  /**
   * When any of the filters change, the query is replaced with new query variables.
   */
  get transactionsQuery(): Query<{ transactions: TransactionModelType[] }> {
    const { address, network } = this.root.web3Store
    const {
      currentFilter: {
        selectedFilterTypes,
        selectedMarket,
        confirmedDateRange: { end, start },
      },
    } = this.root.filterStore

    // only query subgraph if all selected actions are valid actions
    const validatedTypes =
      selectedFilterTypes?.filter((key) => KNOWN_HISTORY_EVENTS_MAP[key] !== undefined) ?? []

    // for simplicity, UI only shows Opened, Closed, Deposited, Withdrawn in the filter modal
    // Closed type includes Redeemed transactions
    if (validatedTypes.includes(FilterType.Closed)) validatedTypes.push(FilterType.Redeemed)

    // only include action types user select
    const types =
      !selectedFilterTypes || validatedTypes.length === 0
        ? Object.keys(KNOWN_HISTORY_EVENTS)
        : validatedTypes.map((key) => KNOWN_HISTORY_EVENTS_MAP[key])

    // only include transactions of selected market
    const tokenAddresses = []
    if (selectedMarket !== 'All') {
      const longTokenAddress = getContractAddress(
        selectedMarket.long.tokenAddress,
        network.name,
        supportedContracts
      )?.toLowerCase()
      const shortTokenAddress = getContractAddress(
        selectedMarket.short.tokenAddress,
        network.name,
        supportedContracts
      )?.toLowerCase()

      if (longTokenAddress) tokenAddresses.push(longTokenAddress)
      if (shortTokenAddress) tokenAddresses.push(shortTokenAddress)
    }

    return this.queryStore.queryTransactions({
      subgraphError: SubgraphErrorPolicy.deny,
      where: {
        ownerAddress: address?.toLowerCase(),
        action_in: types,
        tokenAddress_in: tokenAddresses.length > 0 ? tokenAddresses : undefined,
        createdAtTimestamp_gte: start ? Math.floor(start.getTime() / 1000) : undefined,
        createdAtTimestamp_lte: end ? Math.floor(end.getTime() / 1000) : undefined,
      },
      orderBy: TransactionOrderBy.createdAtTimestamp,
      orderDirection: OrderDirection.desc,
    })
  }
}
