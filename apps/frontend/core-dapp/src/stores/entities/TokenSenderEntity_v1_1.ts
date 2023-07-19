import { ContractReturn, DynamicContractStore } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { FixedUintValueEntity } from './FixedUintValueEntity'
import { RootStore } from '../RootStore'
import { TokenSenderV11Abi, TokenSenderV11Abi__factory } from '../../../generated/typechain'
import { SupportedContracts } from '../../lib/contract.types'
import { WEI_DENOMINATOR } from '../../lib/constants'
import { safeDiv } from '../../utils/safeDiv'

type GetPriceOracle = TokenSenderV11Abi['functions']['getPriceOracle']
type GetPriceLowerBound = TokenSenderV11Abi['functions']['getPriceLowerBound']

// eslint-disable-next-line @typescript-eslint/naming-convention
export class TokenSenderEntity_v1_1 extends DynamicContractStore<RootStore, SupportedContracts> {
  private readonly priceOracle: FixedUintValueEntity

  constructor(rootStore: RootStore, addressGetter: () => string | undefined) {
    super(rootStore, addressGetter, TokenSenderV11Abi__factory)
    this.priceOracle = new FixedUintValueEntity(rootStore, () => this.getPriceOracle()?.[0])
  }

  private getPriceLowerBound(
    ...params: Parameters<GetPriceLowerBound>
  ): ContractReturn<GetPriceLowerBound> {
    return this.call<GetPriceLowerBound>('getPriceLowerBound', params)
  }

  private getPriceOracle(): ContractReturn<GetPriceOracle> {
    return this.call<GetPriceOracle>('getPriceOracle', [], { subscribe: false })
  }

  private get ppoPriceInEth(): BigNumber | undefined {
    const price = this.priceOracle.value
    const priceLowerBound = this.getPriceLowerBound()?.[0]

    if (price === undefined || priceLowerBound === undefined) return undefined
    if (price.lte(priceLowerBound)) return BigNumber.from(0)

    return price
  }

  private get ppoPriceInWstEth(): BigNumber | undefined {
    const { ppoPriceInEth } = this
    if (ppoPriceInEth === undefined) return undefined
    return this.root.balancerStore.getEthAmountInWstEth(ppoPriceInEth)
  }

  calculateReward(scaledFeeInWstEth: BigNumber): BigNumber | undefined {
    const { ppoBalance, ppoPriceInWstEth } = this
    const { decimalsNumber: ppoDecimals } = this.root.ppoTokenStore

    if (ppoDecimals === undefined || ppoPriceInWstEth === undefined || ppoBalance === undefined)
      return undefined
    if (ppoPriceInWstEth.eq(0)) return ppoPriceInWstEth

    const reward = safeDiv(
      scaledFeeInWstEth.mul(BigNumber.from(10).pow(ppoDecimals)),
      ppoPriceInWstEth
    )

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
}
