import { BigNumber } from 'ethers'
import { ContractReturn, DynamicContractStore } from 'prepo-stores'
import { computed, makeObservable, observable } from 'mobx'
import { TokenSenderEntity } from './TokenSenderEntity'
import { SupportedContracts } from '../../lib/contract.types'
import { RootStore } from '../RootStore'
import { RedeemHookAbi, RedeemHookAbi__factory } from '../../../generated/typechain'

type GetTokenSender = RedeemHookAbi['functions']['getTokenSender']

export class RedeemHookEntity extends DynamicContractStore<RootStore, SupportedContracts> {
  readonly tokenSender = new TokenSenderEntity(this.root, () => this.tokenSenderAddress)
  constructor(rootStore: RootStore, addressGetter: () => string | undefined) {
    super(rootStore, addressGetter, RedeemHookAbi__factory)

    makeObservable(this as object, {
      getTokenSenderAddress: observable,
      tokenSenderAddress: computed,
    })
  }

  private getTokenSenderAddress(
    ...params: Parameters<GetTokenSender>
  ): ContractReturn<GetTokenSender> {
    return this.call<GetTokenSender>('getTokenSender', params, { subscribe: false })
  }

  get tokenSenderAddress(): string | undefined {
    return this.getTokenSenderAddress()?.[0]
  }

  calculateReward(feeInWstEth: BigNumber): BigNumber | undefined {
    return this.tokenSender.calculateReward(feeInWstEth)
  }

  calculateRewardValueInEth(ppo?: BigNumber): BigNumber | undefined {
    return this.tokenSender.calculateRewardValueInEth(ppo)
  }
}
