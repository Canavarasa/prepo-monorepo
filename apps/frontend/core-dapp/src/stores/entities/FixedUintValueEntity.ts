import { ContractReturn, DynamicContractStore } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { RootStore } from '../RootStore'
import { SupportedContracts } from '../../lib/contract.types'
import { FixedUintValueAbi, FixedUintValueAbi__factory } from '../../../generated/typechain'

type Get = FixedUintValueAbi['functions']['get']

export class FixedUintValueEntity extends DynamicContractStore<RootStore, SupportedContracts> {
  constructor(rootStore: RootStore, addressGetter: () => string | undefined) {
    super(rootStore, addressGetter, FixedUintValueAbi__factory)
  }

  private get(...params: Parameters<Get>): ContractReturn<Get> {
    return this.call<Get>('get', params)
  }

  get value(): BigNumber | undefined {
    return this.get()?.[0]
  }
}
