import { ContractReturn, ContractStore } from 'prepo-stores'
import { makeObservable, observable } from 'mobx'
import { RootStore } from './RootStore'
import { SupportedContracts } from '../lib/contract.types'
import { BalancerVaultAbi, BalancerVaultAbi__factory } from '../../generated/typechain'

export type GetPoolTokens = BalancerVaultAbi['functions']['getPoolTokens']

export class BalancerVaultStore extends ContractStore<RootStore, SupportedContracts> {
  constructor(root: RootStore) {
    super(root, 'BALANCER_VAULT', BalancerVaultAbi__factory)
    makeObservable(this, { getPoolTokens: observable })
  }

  getPoolTokens(...params: Parameters<GetPoolTokens>): ContractReturn<GetPoolTokens> {
    return this.call<GetPoolTokens>('getPoolTokens', params)
  }
}
