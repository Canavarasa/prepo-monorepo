import { ContractReturn, DynamicContractStore, Factory } from 'prepo-stores'
import { computed, makeObservable, observable } from 'mobx'
import { BigNumber } from 'ethers'
import { TokenSenderEntity_v1_1 } from './TokenSenderEntity_v1_1'
import { FeeHook } from './FeeEntity'
import { RootStore } from '../RootStore'
import { TokenSenderCallerAbi } from '../../../generated/typechain'
import { SupportedContracts } from '../../lib/contract.types'
import { fraction, Fraction, mul } from '../../utils/fraction-utils'

type GetAmountMultiplier = TokenSenderCallerAbi['functions']['getAmountMultiplier']
type GetPercentUnit = TokenSenderCallerAbi['functions']['PERCENT_UNIT']
type GetTokenSender = TokenSenderCallerAbi['functions']['getTokenSender']

export class TokenSenderCallerEntity
  extends DynamicContractStore<RootStore, SupportedContracts>
  implements FeeHook
{
  constructor(
    rootStore: RootStore,
    addressGetter: () => string | undefined,
    private readonly callerAddressGetter: () => string | undefined,
    factory: Factory
  ) {
    super(rootStore, addressGetter, factory)

    makeObservable<
      TokenSenderCallerEntity,
      'amountMultiplier' | 'getAmountMultiplier' | 'getPercentUnit' | 'getTokenSender'
    >(this, {
      amountMultiplier: computed,
      getAmountMultiplier: observable,
      getPercentUnit: observable,
      getTokenSender: observable,
    })
  }

  private getAmountMultiplier(
    ...params: Parameters<GetAmountMultiplier>
  ): ContractReturn<GetAmountMultiplier> {
    return this.call<GetAmountMultiplier>('getAmountMultiplier', params, { subscribe: false })
  }

  private getPercentUnit(...params: Parameters<GetPercentUnit>): ContractReturn<GetPercentUnit> {
    return this.call<GetPercentUnit>('PERCENT_UNIT', params, { subscribe: false })
  }

  private getTokenSender(...params: Parameters<GetTokenSender>): ContractReturn<GetTokenSender> {
    return this.call<GetTokenSender>('getTokenSender', params, { subscribe: false })
  }

  private get amountMultiplier(): Fraction | undefined {
    const callerAddress = this.callerAddressGetter()

    if (callerAddress === undefined) return undefined

    const amountMultiplier = this.getAmountMultiplier(callerAddress)?.[0]
    const percentUnit = this.getPercentUnit()?.[0]

    if (amountMultiplier === undefined || percentUnit === undefined) return undefined

    return fraction(amountMultiplier, percentUnit)
  }

  get tokenSender(): TokenSenderEntity_v1_1 | undefined {
    return this.root.resourceStore.getTokenSender(this.getTokenSender()?.[0])
  }

  calculateReward(feeInWstEth: BigNumber): BigNumber | undefined {
    const { amountMultiplier } = this
    if (amountMultiplier === undefined) return undefined
    return this.tokenSender?.calculateReward(mul(feeInWstEth, amountMultiplier))
  }

  /**
   * @deprecated this exists for legacy purposes, as `TokenSenderCallerEntity`
   * tries to replicate the public API of the legacy `TokenSenderEntity_v1_0`,
   * so that it can be swapped seamlessly. Once we drop the v1.0 entities we
   * can drop this method and callers can call `TokenSender` directly.
   */
  calculateRewardValueInEth(ppo?: BigNumber): BigNumber | undefined {
    return this.tokenSender?.calculateRewardValueInEth(ppo)
  }
}
