import { BigNumber } from 'ethers'
import { makeAutoObservable, runInAction } from 'mobx'
import { validateStringToBN } from 'prepo-utils'
import { toast } from 'prepo-ui'
import { differenceInMilliseconds } from 'date-fns'
import { RootStore } from '../../stores/RootStore'
import { getBalanceLimitInfo } from '../../utils/balance-limits'
import { addDuration } from '../../utils/date-utils'
import { DurationInMs } from '../../utils/date-types'
import { EthConvertible } from '../../stores/BalancerStore'
import { SignedPermit } from '../../stores/entities/Erc20Permit.entity'
import { UnsignedTxOutput } from '../../types/transaction.types'
import { TransactionBundleStore } from '../../stores/TransactionBundleStore'

export type WithdrawLimit =
  | {
      status: 'loading' | 'not-exceeded'
    }
  | {
      amountEth: string
      capEth: string
      remainingEth: string
      // If undefined, withdrawal period was reset already
      resetsIn: DurationInMs | undefined
      status: 'already-exceeded' | 'exceeded-after-transfer'
    }

export class WithdrawStore {
  private static readonly GAS_LIMIT = 2_500_000

  private input: { type: 'input'; value: string } | { type: 'max' } = {
    type: 'input',
    value: '',
  }

  readonly transactionBundle = new TransactionBundleStore({
    actionNames: () => ['Withdraw'],
    actionTxCreator: this.withdraw.bind(this),
    onAfterTransactionSuccess: this.handleAfterTransactionSuccess.bind(this),
    onError: this.handleError.bind(this),
    requiredApproval: () => ({
      amount: this.withdrawalAmount?.inWstEthBN,
      spender: 'DEPOSIT_TRADE_HELPER',
      token: this.root.collateralStore,
    }),
    root: this.root,
  })

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setWithdrawalAmount(value: string): void {
    const { balance } = this.root.collateralStore

    if (!validateStringToBN(value)) {
      return
    }

    if (value === balance?.inEthString) {
      this.input = { type: 'max' }
    } else {
      this.input = { type: 'input', value }
    }
  }

  private withdraw(permit: SignedPermit): UnsignedTxOutput {
    const { address } = this.root.web3Store
    if (
      this.insufficientBalance ||
      !this.withdrawalAmount ||
      this.withdrawalAmount.inWstEthBN.eq(0) ||
      address === undefined
    )
      return {
        success: false,
        error: TransactionBundleStore.UNEXPECTED_ERROR,
      }

    return this.root.depositTradeHelperStore.createWithdrawAndUnwrapTx({
      amountIn: this.withdrawalAmount.inWstEthBN,
      amountOut: this.withdrawalAmount.inEthBN,
      permit,
      recipient: address,
    })
  }

  private handleAfterTransactionSuccess({
    hash,
    type,
  }: {
    hash: string
    type: 'approval' | 'action'
  }): void {
    toast.success(type === 'approval' ? 'Approved Tokens for Withdrawal' : 'Withdrawal Confirmed', {
      link: this.root.web3Store.getBlockExplorerUrl(hash),
    })
    this.input = { type: 'input', value: '' }
  }

  private handleError({ error, hash }: { error: string; hash?: string }): void {
    toast.error('Withdrawal Failed', {
      description: error,
      link: hash ? this.root.web3Store.getBlockExplorerUrl(hash) : undefined,
    })
  }

  get insufficientBalance(): boolean | undefined {
    if (this.withdrawalAmount === undefined || !this.root.collateralStore.balance) return undefined
    return this.withdrawalAmount.inWstEthBN.gt(this.root.collateralStore.balance.inWstEthBN)
  }

  get priceImpactTooHigh(): boolean {
    if (!this.withdrawalAmount) return false
    return this.root.advancedSettingsStore.isEthWstEthPriceImpactTooHigh(
      this.withdrawalAmount.priceImpact
    )
  }

  get isLoadingBalance(): boolean {
    if (!this.root.web3Store.connected) return false
    return this.root.collateralStore.balanceOfSigner === undefined
  }

  get withdrawalAmountInput(): string {
    const { balance } = this.root.collateralStore

    if (this.input.type === 'max') return balance?.inEthString ?? ''

    return this.input.value
  }

  get withdrawalAmount(): EthConvertible | undefined {
    if (this.input.type === 'max') return this.root.collateralStore.balance

    const withdrawalAmountInputBN = this.root.collateralStore.parseUnits(this.withdrawalAmountInput)
    if (!withdrawalAmountInputBN) return undefined
    // converts to wstETH before making convertible to have price impact taken into consideration
    const wstEthSource = this.root.balancerStore.getConvertibleFromEth(withdrawalAmountInputBN)
    if (wstEthSource === undefined) return undefined
    return this.root.balancerStore.getConvertibleFromWstEth(wstEthSource.inWstEthBN)
  }

  get withdrawalDisabled(): boolean {
    return (
      this.withdrawalAmount === undefined ||
      this.withdrawalAmount.inWstEthBN.lte(0) ||
      this.insufficientBalance === undefined ||
      this.insufficientBalance ||
      this.withdrawUILoading ||
      this.withdrawLimit.status === 'already-exceeded' ||
      this.withdrawLimit.status === 'exceeded-after-transfer'
    )
  }

  get withdrawUILoading(): boolean {
    const { permitReady } = this.root.collateralStore
    return (
      !permitReady ||
      this.transactionBundle.transacting ||
      this.withdrawButtonInitialLoading ||
      this.withdrawLimit.status === 'loading'
    )
  }

  get withdrawButtonInitialLoading(): boolean {
    if (this.input.type === 'input' && this.input.value === '') return false
    return Boolean(
      this.isLoadingBalance ||
        this.insufficientBalance === undefined ||
        this.transactionBundle.initialLoading
    )
  }

  get withdrawLimit(): WithdrawLimit {
    const {
      globalAmountWithdrawnThisPeriodInEth,
      globalPeriodLength,
      effectiveGlobalWithdrawLimitPerPeriod,
      lastGlobalPeriodReset,
    } = this.root.collateralStore.withdrawHook
    const { nowInMs } = this.root.timerStore

    if (globalPeriodLength === undefined || lastGlobalPeriodReset === undefined) {
      return {
        status: 'loading',
      }
    }

    const periodAlreadyReset =
      differenceInMilliseconds(nowInMs, lastGlobalPeriodReset) > globalPeriodLength

    const limitInfo = getBalanceLimitInfo({
      additionalAmount: this.withdrawalAmount?.inEthBN,
      cap: effectiveGlobalWithdrawLimitPerPeriod,
      // If the reset window has passed, disregard the value of globalAmountWithdrawnThisPeriod.
      // The amount withdrawn is effectively zero.
      // When someone withdraws, globalAmountWithdrawnThisPeriod will update and thus the withdraw limit will be recomputed
      currentAmount: periodAlreadyReset ? BigNumber.from(0) : globalAmountWithdrawnThisPeriodInEth,
    })

    if (limitInfo.status === 'already-exceeded' || limitInfo.status === 'exceeded-after-transfer') {
      const nextGlobalPeriodReset = addDuration(lastGlobalPeriodReset, globalPeriodLength)
      const timeToReset = differenceInMilliseconds(nextGlobalPeriodReset, nowInMs) as DurationInMs

      return {
        ...limitInfo,
        resetsIn: periodAlreadyReset ? undefined : timeToReset,
      }
    }

    return {
      status: limitInfo.status,
    }
  }

  get slippage(): number {
    return this.root.advancedSettingsStore.slippageForDeposits
  }

  get gasCostBN(): BigNumber | undefined {
    return this.root.gasStore.maxFeePerGas?.mul(WithdrawStore.GAS_LIMIT)
  }
}
