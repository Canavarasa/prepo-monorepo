import { ContractReturn, ContractStore } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { computed, makeObservable, observable } from 'mobx'
import { RootStore } from './RootStore'
import { SupportedContracts } from '../lib/contract.types'
import { BaseFeeGetterAbi, BaseFeeGetterAbi__factory } from '../../generated/typechain'

type GetBaseFee = BaseFeeGetterAbi['functions']['getBaseFee']

export class GasStore extends ContractStore<RootStore, SupportedContracts> {
  constructor(root: RootStore) {
    super(root, 'BASE_FEE_GETTER', BaseFeeGetterAbi__factory)

    makeObservable<GasStore, 'baseFee' | 'getBaseFee' | 'maxPriorityFeePerGas'>(this, {
      baseFee: computed,
      getBaseFee: observable,
      maxFeePerGas: computed,
      maxPriorityFeePerGas: computed,
    })
  }

  private getBaseFee(...params: Parameters<GetBaseFee>): ContractReturn<GetBaseFee> {
    return this.call<GetBaseFee>('getBaseFee', params)
  }

  get maxFeePerGas(): BigNumber | undefined {
    const { baseFee, maxPriorityFeePerGas } = this
    if (baseFee === undefined) return undefined
    return baseFee.add(maxPriorityFeePerGas)
  }

  private get baseFee(): BigNumber | undefined {
    return this.getBaseFee()?.[0]
  }

  // Arbitrum doesn't require priority fees. Needs updating to support other networks.
  // eslint-disable-next-line class-methods-use-this
  private get maxPriorityFeePerGas(): BigNumber {
    return BigNumber.from(0)
  }
}
