import { action, makeAutoObservable, reaction, runInAction } from 'mobx'
import { RootStore } from '../../stores/RootStore'
import { PositionEntity } from '../../stores/entities/Position.entity'
import { TransactionModelType } from '../../../generated/mst-gql/core-dapp/TransactionModel'

export type Transaction = Required<Partial<TransactionModelType>>

export class PortfolioStore {
  selectedPosition?: Required<PositionEntity>
  signerCostBasis?: Record<string, number> = undefined

  constructor(public root: RootStore) {
    makeAutoObservable(this, {
      setSelectedPosition: action.bound,
    })

    this.syncPositions()
  }

  private syncPositions(): void {
    // using this reaction guaratantees we only fetch positions once per address
    reaction(
      () => this.root.web3Store.address,
      async (address) => {
        // clean up cost basis data if user changes address to fetch new data
        this.signerCostBasis = undefined
        if (!address) return

        const { positions } = await this.root.coreGraphStore
          .positionsQuery(address)
          .currentPromise()

        if (!positions) return

        runInAction(() => {
          positions?.forEach((position) => {
            const { id } = position.longShortToken
            const { costBasis } = position

            if (!this.signerCostBasis) this.signerCostBasis = {}
            this.signerCostBasis[id] = costBasis
          })
        })
      }
    )
  }

  setSelectedPosition(position?: Required<PositionEntity>): void {
    this.selectedPosition = position
  }

  get transactionHistory(): Transaction[] | undefined {
    const { address } = this.root.web3Store
    if (!address) return []

    return this.root.coreGraphStore.transactionsQuery.data?.transactions as Transaction[]
  }

  // all possible positions including those that user has 0 balance
  get allPositions(): PositionEntity[] {
    const { marketStore } = this.root
    const { markets } = marketStore

    const positions: PositionEntity[] = []
    Object.values(markets ?? {}).forEach((market) => {
      positions.push(new PositionEntity(this.root, market, 'long'))
      positions.push(new PositionEntity(this.root, market, 'short'))
    })

    return positions
  }

  // only positions where user has more than 0 balance
  get userPositions(): PositionEntity[] | undefined {
    let loading = false
    const positions = this.allPositions.filter((position) => {
      if (position.hasPosition === undefined) loading = true
      return position.hasPosition
    })

    return loading ? undefined : positions
  }

  get portfolioValue(): string | undefined {
    const { collateralStore } = this.root
    if (this.tradingPositionsValue === undefined || collateralStore.balance === undefined)
      return undefined

    const tradingPositionsAndBalance =
      Number(this.tradingPositionsValue) + collateralStore.balance.inEth

    if (Number.isNaN(tradingPositionsAndBalance)) return undefined

    return `${tradingPositionsAndBalance}`
  }

  get tradingPositionsValue(): number | undefined {
    if (this.userPositions === undefined) return undefined
    let valueSum = 0
    this.userPositions.forEach(({ totalValueInEth }) => {
      valueSum += Number(totalValueInEth ?? 0)
    })
    return valueSum
  }
}
