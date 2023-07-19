import { formatEther } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import { makeAutoObservable, reaction, runInAction } from 'mobx'
import { toast } from 'prepo-ui'
import { parseUnits, validateStringToBN } from 'prepo-utils'
import { RootStore } from '../../stores/RootStore'
import { DepositLimit, getDepositLimit } from '../../utils/balance-limits'
import { EthConvertible } from '../../stores/BalancerStore'

export class DepositStore {
  private static readonly GAS_LIMIT = 2_500_000

  depositAmount = ''
  depositing = false

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
    this.subscribeDepositBalance()
  }

  subscribeDepositBalance(): void {
    reaction(
      () => this.depositBalanceAfterGas,
      (balanceAfterGas) => {
        if (balanceAfterGas === undefined) return

        if (+balanceAfterGas <= 0) {
          this.depositAmount = ''
        } else {
          this.depositAmount = balanceAfterGas
        }
      }
    )
  }

  setDepositAmount(amount: string): void {
    if (validateStringToBN(amount)) this.depositAmount = amount
  }

  async deposit(): Promise<boolean> {
    const { address } = this.root.web3Store

    if (this.depositAmountBN === undefined || address === undefined) return false

    this.depositing = true

    const { hash, error } = await this.root.depositTradeHelperStore.wrapAndDeposit(
      address,
      this.depositAmountBN
    )

    const explorerUrl = hash ? this.root.web3Store.getBlockExplorerUrl(hash) : undefined

    if (error) {
      toast.error('Deposit Failed', { description: error, link: explorerUrl })
    } else {
      toast.success('Deposit Confirmed', { link: explorerUrl })
    }

    runInAction(() => {
      this.depositing = false
    })

    return !error
  }

  get depositButtonInitialLoading(): boolean {
    return (
      this.depositAmountBN === undefined ||
      this.root.collateralStore.depositsAllowed === undefined ||
      this.root.balancerStore.loading
    )
  }

  get depositButtonLoading(): boolean {
    return (
      this.depositing ||
      this.depositButtonInitialLoading ||
      this.isLoadingBalance ||
      this.depositLimit.status === 'loading'
    )
  }

  get depositDisabled(): boolean {
    return Boolean(
      this.depositAmount === '' ||
        this.depositAmountBN?.eq(0) ||
        this.depositButtonInitialLoading ||
        this.depositing ||
        this.insufficientBalance ||
        this.depositLimit.status === 'already-exceeded' ||
        this.depositLimit.status === 'exceeded-after-transfer' ||
        !this.root.collateralStore.depositsAllowed
    )
  }

  get depositAmountBN(): BigNumber | undefined {
    if (this.depositAmount === '') return BigNumber.from(0)
    return parseUnits(this.depositAmount, 18)
  }

  get amount(): EthConvertible | undefined {
    if (this.depositAmountBN === undefined) return undefined
    return this.root.balancerStore.getConvertibleFromEth(this.depositAmountBN)
  }

  get amountOut(): EthConvertible | undefined {
    if (this.amount === undefined) return undefined
    return this.root.balancerStore.getConvertibleFromWstEth(this.amount.inWstEthBN)
  }

  get insufficientBalance(): boolean | undefined {
    if (!this.root.web3Store.connected) return false
    const balanceBN = this.root.web3Store.signerState.balance

    if (balanceBN === undefined || this.depositAmountBN === undefined) return undefined

    return this.depositAmountBN.gt(balanceBN)
  }

  get isLoadingBalance(): boolean {
    if (!this.root.web3Store.connected) return false
    const { balance } = this.root.web3Store.signerState
    return balance === undefined
  }

  get depositLimit(): DepositLimit {
    return getDepositLimit({
      connected: this.root.web3Store.connected,
      depositAmount: this.depositAmountBN,
      depositRecordStore: this.root.depositRecordStore,
      isNetworkSupported: this.root.web3Store.isNetworkSupported,
    })
  }

  get gasCostBN(): BigNumber | undefined {
    return this.root.gasStore.maxFeePerGas?.mul(DepositStore.GAS_LIMIT)
  }

  get depositBalanceAfterGasBN(): BigNumber | undefined {
    if (this.gasCostBN === undefined) return undefined
    return this.root.web3Store.signerState.balance?.sub(this.gasCostBN)
  }

  get depositBalanceAfterGas(): string | undefined {
    if (this.depositBalanceAfterGasBN === undefined) return undefined
    return formatEther(this.depositBalanceAfterGasBN)
  }

  get slippage(): number {
    return this.root.advancedSettingsStore.slippageForDeposits
  }
}
