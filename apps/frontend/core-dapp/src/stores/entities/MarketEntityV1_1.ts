import { makeObservable } from 'mobx'
import { BaseMarketEntity } from './BaseMarketEntity'
import { PrepoMarketV11Abi__factory } from '../../../generated/typechain'
import { Market } from '../../types/market.types'
import { RootStore } from '../RootStore'

// eslint-disable-next-line @typescript-eslint/naming-convention
export class MarketEntityV1_1 extends BaseMarketEntity {
  constructor(public readonly root: RootStore, public readonly data: Market) {
    super(root, data, PrepoMarketV11Abi__factory)
    makeObservable(this, {})
  }
}
