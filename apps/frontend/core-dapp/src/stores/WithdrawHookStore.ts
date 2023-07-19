import { ContractReturn } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { RootStore } from './RootStore'
import { TokenSenderCallerEntity } from './entities/TokenSenderCallerEntity'
import { WithdrawHookAbi, WithdrawHookAbi__factory } from '../../generated/typechain'
import { DateTimeInMs, DurationInMs } from '../utils/date-types'

type GetGlobalAmountWithdrawnThisPeriod =
  WithdrawHookAbi['functions']['getGlobalAmountWithdrawnThisPeriod']
type GetGlobalPeriodLength = WithdrawHookAbi['functions']['getGlobalPeriodLength']
type GetGlobalWithdrawLimitPerPeriod =
  WithdrawHookAbi['functions']['getGlobalWithdrawLimitPerPeriod']
type GetEffectiveGlobalWithdrawLimitPerPeriod =
  WithdrawHookAbi['functions']['getEffectiveGlobalWithdrawLimitPerPeriod']
type GetLastGlobalPeriodReset = WithdrawHookAbi['functions']['getLastGlobalPeriodReset']

export class WithdrawHookStore extends TokenSenderCallerEntity {
  constructor(root: RootStore, addressGetter: () => string | undefined) {
    super(root, addressGetter, () => root.collateralStore.address, WithdrawHookAbi__factory)
  }

  private getGlobalAmountWithdrawnThisPeriod(
    ...params: Parameters<GetGlobalAmountWithdrawnThisPeriod>
  ): ContractReturn<GetGlobalAmountWithdrawnThisPeriod> {
    return this.call<GetGlobalAmountWithdrawnThisPeriod>(
      'getGlobalAmountWithdrawnThisPeriod',
      params
    )
  }

  private getGlobalPeriodLength(
    ...params: Parameters<GetGlobalPeriodLength>
  ): ContractReturn<GetGlobalPeriodLength> {
    return this.call<GetGlobalPeriodLength>('getGlobalPeriodLength', params)
  }

  private getEffectiveGlobalWithdrawLimitPerPeriod(
    ...params: Parameters<GetEffectiveGlobalWithdrawLimitPerPeriod>
  ): ContractReturn<GetEffectiveGlobalWithdrawLimitPerPeriod> {
    return this.call<GetEffectiveGlobalWithdrawLimitPerPeriod>(
      'getEffectiveGlobalWithdrawLimitPerPeriod',
      params
    )
  }

  private getGlobalWithdrawLimitPerPeriod(
    ...params: Parameters<GetGlobalWithdrawLimitPerPeriod>
  ): ContractReturn<GetGlobalWithdrawLimitPerPeriod> {
    return this.call<GetGlobalWithdrawLimitPerPeriod>('getGlobalWithdrawLimitPerPeriod', params)
  }

  private getLastGlobalPeriodReset(
    ...params: Parameters<GetLastGlobalPeriodReset>
  ): ContractReturn<GetLastGlobalPeriodReset> {
    return this.call<GetLastGlobalPeriodReset>('getLastGlobalPeriodReset', params)
  }

  get effectiveGlobalWithdrawLimitPerPeriod(): BigNumber | undefined {
    return this.getEffectiveGlobalWithdrawLimitPerPeriod()?.[0]
  }

  get globalAmountWithdrawnThisPeriod(): BigNumber | undefined {
    return this.getGlobalAmountWithdrawnThisPeriod()?.[0]
  }

  get globalAmountWithdrawnThisPeriodInEth(): BigNumber | undefined {
    const { globalAmountWithdrawnThisPeriod } = this
    if (globalAmountWithdrawnThisPeriod === undefined) return undefined
    return this.root.balancerStore.getWstEthAmountInEth(globalAmountWithdrawnThisPeriod)
  }

  get globalPeriodLength(): DurationInMs | undefined {
    const length = this.getGlobalPeriodLength()?.[0]
    if (length === undefined) return undefined
    return length.mul(1000).toNumber() as DurationInMs
  }

  get globalWithdrawLimitPerPeriod(): BigNumber | undefined {
    return this.getGlobalWithdrawLimitPerPeriod()?.[0]
  }

  get globalWithdrawLimitPerPeriodInEth(): BigNumber | undefined {
    const { globalWithdrawLimitPerPeriod } = this
    if (globalWithdrawLimitPerPeriod === undefined) return undefined
    return this.root.balancerStore.getWstEthAmountInEth(globalWithdrawLimitPerPeriod)
  }

  get lastGlobalPeriodReset(): DateTimeInMs | undefined {
    const lastReset = this.getLastGlobalPeriodReset()?.[0]
    if (lastReset === undefined) return undefined
    return lastReset.mul(1000).toNumber() as DateTimeInMs
  }
}
