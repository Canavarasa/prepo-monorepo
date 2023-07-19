import { ContractReturn, DynamicContractStore } from 'prepo-stores'
import { RootStore } from '../RootStore'
import { SupportedContracts } from '../../lib/contract.types'
import { AddressBeaconAbi, AddressBeaconAbi__factory } from '../../../generated/typechain'

type Get = AddressBeaconAbi['functions']['get']

export class AddressBeaconEntity extends DynamicContractStore<RootStore, SupportedContracts> {
  constructor(public root: RootStore, address: string) {
    super(root, () => address, AddressBeaconAbi__factory)
  }

  get(...params: Parameters<Get>): ContractReturn<Get> {
    return this.call<Get>('get', params)
  }
}
