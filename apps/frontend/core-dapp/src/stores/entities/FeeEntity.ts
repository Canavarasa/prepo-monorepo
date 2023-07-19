import { BigNumber } from 'ethers'
import memoize from 'lodash/memoize'
import { makeAutoObservable } from 'mobx'
import { formatEther } from 'ethers/lib/utils'
import { Fraction, mul, toPercent } from '../../utils/fraction-utils'

export type PpoReward = {
  readonly inEth: BigNumber
  readonly inPpo: BigNumber
}

export const EMPTY_PPO_REBATE: PpoReward = {
  inEth: BigNumber.from(0),
  inPpo: BigNumber.from(0),
}

type DebugInfo = {
  feeHook: string
  base: string
  fee: string
  ppo: string
  'ppo-value-in-eth': string
}

const printDebugInfo = memoize((info: DebugInfo[]): void => {
  if (info.length <= 1) return
  // eslint-disable-next-line no-console
  console.table(info)
}, JSON.stringify)

/**
 * @deprecated this only exists for v1.0 <-> v1.1 compatibility purposes. Once
 * the v1.0 code is removed, this can be substituted in place for
 * `TokenSenderCaller`.
 */
export interface FeeHook {
  address?: string
  calculateReward(feeInWstEth: BigNumber): BigNumber | undefined
  calculateRewardValueInEth(ppo?: BigNumber): BigNumber | undefined
}

export class FeeStore {
  private readonly applicableToWstEthGetter: () => BigNumber | undefined
  private readonly feeHook: FeeHook | undefined

  readonly fee: Fraction

  constructor({
    applicableToWstEth,
    fee,
    feeHook,
  }: {
    applicableToWstEth: () => BigNumber | undefined
    fee: Fraction
    feeHook: FeeHook | undefined
  }) {
    this.applicableToWstEthGetter = applicableToWstEth
    this.fee = fee
    this.feeHook = feeHook

    makeAutoObservable(this)
  }

  get amountAfterFeeInWstEth(): BigNumber | undefined {
    const { feeAmountInWstEth } = this
    const applicableTo = this.applicableToWstEthGetter()
    if (applicableTo === undefined || feeAmountInWstEth === undefined) return undefined
    return applicableTo.sub(feeAmountInWstEth)
  }

  get feeAmountInWstEth(): BigNumber | undefined {
    const applicableTo = this.applicableToWstEthGetter()
    if (applicableTo === undefined) return undefined
    return mul(applicableTo, this.fee)
  }

  static getTotalFeeInWstEth(fees: readonly FeeStore[]): BigNumber | undefined {
    let total = BigNumber.from(0)

    for (const fee of fees) {
      if (fee.feeAmountInWstEth === undefined) return undefined
      total = total.add(fee.feeAmountInWstEth)
    }

    return total
  }

  static getTotalReward(fees: readonly FeeStore[]): PpoReward | undefined {
    let totalPpo = BigNumber.from(0)
    let totalEth = BigNumber.from(0)

    const debugInfo: DebugInfo[] = []

    for (const fee of fees) {
      if (fee.feeAmountInWstEth === undefined) return undefined

      const base = fee.applicableToWstEthGetter()
      const baseDebug = base ? `${formatEther(base)} wstETH` : '-'
      const feeDebug = `${(toPercent(fee.fee) * 100).toFixed(2)} %`

      if (fee.feeHook === undefined) {
        debugInfo.push({
          feeHook: `(external)`,
          base: baseDebug,
          fee: feeDebug,
          ppo: '-',
          'ppo-value-in-eth': '-',
        })
      } else {
        const reward = fee.feeHook.calculateReward(fee.feeAmountInWstEth)
        if (reward === undefined) return undefined
        totalPpo = totalPpo.add(reward)

        const rewardValue = fee.feeHook.calculateRewardValueInEth(reward)
        if (rewardValue === undefined) return undefined
        totalEth = totalEth.add(rewardValue)

        debugInfo.push({
          feeHook: `${fee.feeHook.address?.slice(0, 6)}`,
          base: baseDebug,
          fee: feeDebug,
          ppo: `${formatEther(reward)} PPO`,
          'ppo-value-in-eth': `${formatEther(rewardValue)} ETH`,
        })
      }
    }

    debugInfo.push({
      feeHook: 'TOTAL',
      base: '-',
      fee: '-',
      ppo: `${formatEther(totalPpo)} PPO`,
      'ppo-value-in-eth': `${formatEther(totalEth)} ETH`,
    })

    printDebugInfo(debugInfo)

    return {
      inEth: totalEth,
      inPpo: totalPpo,
    }
  }
}
