import { makeAutoObservable } from 'mobx'
import { BigNumber } from 'ethers'
import { parseUnits } from 'prepo-utils'
import { RootStore } from '../../stores/RootStore'

export class AdvancedSettingsStore {
  root: RootStore
  private readonly ETH_WSTETH_PRICE_IMPACT_TOLERANCE = 0.05 / 100
  private readonly SLIPPAGE_FOR_DEPOSITS = 0.05 / 100
  private readonly SLIPPAGE_FOR_TRADES = 0.5 / 100

  constructor(root: RootStore) {
    this.root = root
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get slippageForDeposits(): number {
    return this.SLIPPAGE_FOR_DEPOSITS
  }

  get slippageForTrades(): number {
    return this.SLIPPAGE_FOR_TRADES
  }

  isEthWstEthPriceImpactTooHigh(priceImpact: number): boolean {
    return priceImpact >= this.ETH_WSTETH_PRICE_IMPACT_TOLERANCE
  }

  getAmountAfterSlippageForDeposits(amount: BigNumber): BigNumber {
    return AdvancedSettingsStore.getAmountAfterSlippage(amount, this.SLIPPAGE_FOR_DEPOSITS)
  }

  getAmountAfterSlippageForTrades(amount: BigNumber): BigNumber {
    return AdvancedSettingsStore.getAmountAfterSlippage(amount, this.slippageForTrades)
  }

  /*
   * Given an amount, returns the minimum amount to be received when accounting
   * for slippage. This is the amount that is sent to the blockchain. The user
   * may receive more than this amount, but if they receive less, the trade
   * reverts.
   */
  private static getAmountAfterSlippage(amount: BigNumber, slippage: number): BigNumber {
    const percent = parseUnits((1 - slippage).toString(), 18)
    if (percent === undefined) return amount

    return amount.mul(percent).div(BigNumber.from(10).pow(18))
  }
}
