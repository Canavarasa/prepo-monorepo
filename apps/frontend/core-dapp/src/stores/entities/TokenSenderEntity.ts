import { ContractReturn, DynamicContractStore, Factory } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { FixedUintValueEntity } from './FixedUintValueEntity'
import { RootStore } from '../RootStore'
import { TokenSenderAbi, TokenSenderAbi__factory } from '../../../generated/typechain'
import { SupportedContracts } from '../../lib/contract.types'
import { WEI_DENOMINATOR } from '../../lib/constants'
import { safeDiv } from '../../utils/safeDiv'

type GetPrice = TokenSenderAbi['functions']['getPrice']
type GetScaledPrice = TokenSenderAbi['functions']['getScaledPrice']
type GetScaledPriceLowerBound = TokenSenderAbi['functions']['getScaledPriceLowerBound']

export class TokenSenderEntity extends DynamicContractStore<RootStore, SupportedContracts> {
  private priceContainer: FixedUintValueEntity

  constructor(rootStore: RootStore, addressGetter: () => string | undefined) {
    super(rootStore, addressGetter, TokenSenderAbi__factory as unknown as Factory)
    this.priceContainer = new FixedUintValueEntity(
      rootStore,
      () => this.getPriceContainerAddress()?.[0]
    )
  }

  private getScaledPrice(...params: Parameters<GetScaledPrice>): ContractReturn<GetScaledPrice> {
    return this.call<GetScaledPrice>('getScaledPrice', params)
  }

  private getScaledPriceLowerBound(
    ...params: Parameters<GetScaledPriceLowerBound>
  ): ContractReturn<GetScaledPriceLowerBound> {
    return this.call<GetScaledPriceLowerBound>('getScaledPriceLowerBound', params)
  }

  private getPriceContainerAddress(): ContractReturn<GetPrice> {
    return this.call<GetPrice>('getPrice', [], { subscribe: false })
  }

  private get scaledPrice(): BigNumber | undefined {
    const scaledPrice = this.getScaledPrice()?.[0]
    const scaledPriceLowerBound = this.getScaledPriceLowerBound()?.[0]

    if (scaledPrice === undefined || scaledPriceLowerBound === undefined) return undefined
    if (scaledPrice.lte(scaledPriceLowerBound)) return BigNumber.from(0)

    return scaledPrice
  }

  calculateReward(feeInWstEth: BigNumber): BigNumber | undefined {
    const { ppoBalance, scaledPrice } = this
    const { decimalsNumber: ppoDecimals } = this.root.ppoTokenStore

    if (ppoDecimals === undefined || scaledPrice === undefined || ppoBalance === undefined)
      return undefined
    if (scaledPrice.eq(0)) return scaledPrice

    const reward = safeDiv(feeInWstEth.mul(BigNumber.from(10).pow(ppoDecimals)), scaledPrice)

    if (reward.gt(ppoBalance)) {
      return BigNumber.from(0)
    }

    return reward
  }

  calculateRewardValueInEth(ppo?: BigNumber): BigNumber | undefined {
    if (this.ppoPriceInEth === undefined || ppo === undefined) return undefined
    return ppo.mul(this.ppoPriceInEth).div(WEI_DENOMINATOR)
  }

  private get ppoBalance(): BigNumber | undefined {
    const { address } = this
    if (address === undefined) return undefined
    return this.root.ppoTokenStore.balanceOf(address)?.[0]
  }

  private get ppoPriceInEth(): BigNumber | undefined {
    return this.priceContainer?.value
  }
}
