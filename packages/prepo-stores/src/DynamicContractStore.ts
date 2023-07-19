import { SupportedNetworks } from 'prepo-constants'
import { reaction } from 'mobx'
import { ContractStore } from './ContractStore'
import { RootStore } from './RootStore'
import { Factory } from './utils/stores.types'
import { DYNAMIC_CONTRACT_ADDRESS } from './utils/constants'

type SupportedContractsWithDynamic = {
  [key in typeof DYNAMIC_CONTRACT_ADDRESS]?: {
    [networkKey in SupportedNetworks]?: string
  }
}

export class DynamicContractStore<
  RootStoreType,
  SupportedContracts extends SupportedContractsWithDynamic
> extends ContractStore<RootStoreType, SupportedContracts> {
  constructor(
    rootStore: RootStore<SupportedContracts> & RootStoreType,
    addressGetter: () => string | undefined,
    factory: Factory
  ) {
    super(rootStore, DYNAMIC_CONTRACT_ADDRESS, factory)

    const cleanup = reaction(
      () => ({ address: addressGetter() }),
      ({ address }) => {
        if (address === undefined) return
        this.updateAddress(address)
        cleanup()
      }
    )
  }
}
