import { TokenSenderCallerEntity } from './TokenSenderCallerEntity'
import { RootStore } from '../RootStore'
import { MarketHookAbi__factory } from '../../../generated/typechain'

export class MarketHookEntity extends TokenSenderCallerEntity {
  constructor(
    public readonly root: RootStore,
    addressGetter: () => string | undefined,
    callerAddressGetter: () => string | undefined
  ) {
    super(root, addressGetter, callerAddressGetter, MarketHookAbi__factory)
  }
}
