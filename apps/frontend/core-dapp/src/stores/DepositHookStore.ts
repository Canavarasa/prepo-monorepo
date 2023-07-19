import { makeObservable, computed } from 'mobx'
import { RootStore } from './RootStore'
import { TokenSenderCallerEntity } from './entities/TokenSenderCallerEntity'
import { DepositHookAbi, DepositHookAbi__factory } from '../../generated/typechain'

type GetDepositsAllowed = DepositHookAbi['functions']['getDepositsAllowed']
type GetDepositRecord = DepositHookAbi['functions']['getDepositRecord']

export class DepositHookStore extends TokenSenderCallerEntity {
  constructor(public root: RootStore, addressGetter: () => string | undefined) {
    super(root, addressGetter, () => root.collateralStore.address, DepositHookAbi__factory)
    makeObservable(this, { depositsAllowed: computed, depositRecord: computed })
  }

  get depositsAllowed(): boolean | undefined {
    return this.call<GetDepositsAllowed>('getDepositsAllowed', [])?.[0]
  }

  get depositRecord(): string | undefined {
    return this.call<GetDepositRecord>('getDepositRecord', [])?.[0]
  }
}
