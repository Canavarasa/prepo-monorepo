import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { makeAutoObservable, reaction, runInAction } from 'mobx'
import { toast } from 'prepo-ui'
import { validateStringToBN } from 'prepo-utils'
import { RootStore } from '../../../stores/RootStore'
import { PositionEntity } from '../../../stores/entities/Position.entity'
import { WEI_DENOMINATOR } from '../../../lib/constants'
import { calculateValuation } from '../../../utils/market-utils'
import { fraction, toPercent } from '../../../utils/fraction-utils'
import { safeDiv } from '../../../utils/safeDiv'
import { EthConvertible } from '../../../stores/BalancerStore'
import { BaseMarketEntity } from '../../../stores/entities/BaseMarketEntity'
import { SignedPermit } from '../../../stores/entities/Erc20Permit.entity'
import { UnsignedTxOutput } from '../../../types/transaction.types'
import { TransactionBundleStore } from '../../../stores/TransactionBundleStore'

export class CloseTradeStore {
  private static readonly GAS_LIMIT = 2_500_000

  input: { type: 'max' } | { type: 'input'; value: string } = {
    type: 'input',
    value: '',
  }
  amountOutBN?: BigNumber = undefined

  readonly transactionBundle = new TransactionBundleStore({
    actionNames: () => {
      const { selectedMarket, selectedPosition, value } = this
      const verb = selectedMarket?.resolved ? 'Redeem' : 'Close'

      if (
        value !== undefined &&
        value.inEthBN.gt(0) &&
        selectedPosition?.totalValueInEthBN !== undefined
      ) {
        const percentage = toPercent(
          fraction(value.inEthBN.mul(100), selectedPosition.totalValueInEthBN)
        )
        return [`${verb} Position (${percentage > 0.01 ? percentage.toFixed(2) : '<0.01'}%)`]
      }

      return [`${verb} Position`]
    },
    actionTxCreator: this.closeOrRedeemPosition.bind(this),
    onAfterTransactionSuccess: this.handleAfterTransactionSuccess.bind(this),
    onError: this.handleError.bind(this),
    requiredApproval: () => ({
      // Redeeming requires no approvals, therefore pretend amount is zero
      amount: this.selectedMarket?.resolved ? BigNumber.from(0) : this.value?.inWstEthBN,
      spender: 'DEPOSIT_TRADE_HELPER',
      token: this.selectedPosition?.token,
    }),
    root: this.root,
  })

  constructor(private root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
    this.subscribeClosePositionAmountOut()
  }

  private subscribeClosePositionAmountOut(): void {
    reaction(
      () => ({
        action: this.root.tradeStore.action,
        selectedPosition: this.selectedPosition,
        amountBN: this.amountBN,
        marketValuation: this.selectedMarket?.estimatedValuation,
        fee: this.selectedPosition?.pool.poolImmutables?.fee,
      }),
      async ({ action, amountBN, selectedPosition, fee }) => {
        if (action !== 'close') return
        const { address: collateralAddress } = this.root.collateralStore

        if (
          amountBN === undefined ||
          !collateralAddress ||
          !selectedPosition?.token.address ||
          fee === undefined
        )
          return

        const output = await this.root.swapStore.quoteExactInput({
          amountBN,
          fromAddress: selectedPosition.token.address,
          toAddress: collateralAddress,
          fee,
        })

        runInAction(() => {
          if (output === undefined) return
          this.amountOutBN = output.output
        })
      }
    )
  }

  // clean up when the tab is left
  reset(): void {
    this.amountOutBN = undefined
    this.setInput('')
  }

  get selectedMarket(): BaseMarketEntity | undefined {
    return this.root.tradeStore?.selectedMarket
  }

  get selectedPosition(): PositionEntity | undefined {
    return this.root.tradeStore?.selectedPosition
  }

  // input states

  setInput(value: string): void {
    if (validateStringToBN(value)) {
      this.amountOutBN = undefined
      this.input =
        value === this.selectedPosition?.totalValueInEth
          ? { type: 'max' }
          : { type: 'input', value }
    }
  }

  get value(): EthConvertible | undefined {
    const valueBN = this.selectedPosition?.token.parseUnits(this.inputValue)
    if (valueBN === undefined) return undefined
    return this.root.balancerStore.getConvertibleFromEth(valueBN)
  }

  get inputValue(): string {
    if (this.selectedMarket?.resolved || this.input.type === 'max') {
      return this.selectedPosition?.totalValueInEth ?? ''
    }

    return this.input.value
  }

  // long short token amount

  get amountBN(): BigNumber | undefined {
    if (
      !this.selectedPosition ||
      this.selectedPosition.priceInWstEthBN === undefined ||
      this.value === undefined
    )
      return undefined

    if (this.selectedMarket?.resolved || this.root.closeTradeStore.input.type === 'max')
      return this.selectedPosition.token.balanceOfSigner

    if (this.selectedPosition.priceInWstEthBN.eq(0)) return undefined

    // we converted price to priceBN with WEI_DENOMINATOR to hold decimals in the price for more precise calculation
    // (18 decimals) so when converting from value to long/short token amount, we need to multiply the denominator
    // because when we divide priceBN, the price has been multiplied by the same WEI_DENOMINATOR
    return safeDiv(
      this.value.inWstEthBN.mul(WEI_DENOMINATOR),
      this.selectedPosition.priceInWstEthBN
    )
  }

  get amount(): string | undefined {
    if (this.amountBN === undefined || this.selectedPosition === undefined) return undefined

    return this.selectedPosition.token.formatUnits(this.amountBN)
  }

  // UI states

  get disabled(): boolean {
    return Boolean(
      !this.selectedPosition ||
        this.inputValue === '' ||
        this.value?.inEthBN.eq(0) ||
        this.loading ||
        this.amountOutInWstEthBN === undefined ||
        this.insufficientBalance
    )
  }

  get initialLoading(): boolean {
    if (this.inputValue === '') return false
    const loadingSelectedPosition =
      this.selectedPosition !== undefined &&
      (this.selectedPosition.hasPosition === undefined || !this.selectedPosition.token.permitReady)

    return (
      loadingSelectedPosition ||
      // these values should only be undefined once while token's decimals is undefined
      this.value === undefined ||
      this.transactionBundle.initialLoading === undefined ||
      this.insufficientBalance === undefined
    )
  }

  get loading(): boolean {
    return this.initialLoading || this.transactionBundle.transacting
  }

  get insufficientBalance(): boolean | undefined {
    if (!this.selectedPosition || !this.root.web3Store.connected) return false
    if (this.value === undefined || this.selectedPosition.totalValueInEthBN === undefined)
      return undefined

    return this.value.inEthBN.gt(this.selectedPosition.totalValueInEthBN)
  }

  get withinBounds(): boolean | undefined {
    if (this.selectedMarket === undefined || this.selectedMarket.payoutRange === undefined)
      return undefined

    const { payoutRange } = this.selectedMarket
    const [lowerBound, upperBound] = payoutRange
    if (this.price === undefined) return undefined
    return this.price > lowerBound && this.price < upperBound
  }

  // redeem stuffs

  private get redeemAmountOutInWstEthBN(): BigNumber | undefined {
    const { direction } = this.root.tradeStore
    const { selectedMarket, selectedPosition } = this
    if (selectedMarket === undefined || selectedPosition === undefined) return undefined
    const { finalLongPayout } = selectedMarket
    const {
      token: { balanceOfSigner },
    } = selectedPosition

    if (
      finalLongPayout === undefined ||
      finalLongPayout.gt(parseEther('1')) ||
      balanceOfSigner === undefined
    ) {
      return undefined
    }

    if (direction === 'long') {
      return safeDiv(balanceOfSigner.mul(finalLongPayout), parseEther('1'))
    }

    return safeDiv(balanceOfSigner.mul(parseEther('1').sub(finalLongPayout)), parseEther('1'))
  }

  // amount out and pricing calculations

  get amountOutInWstEthBN(): BigNumber | undefined {
    return this.redeemAmountOutInWstEthBN ?? this.amountOutBN
  }

  get amountOut(): string | undefined {
    if (this.amountOutInWstEthBN === undefined || !this.selectedPosition) return undefined
    return this.selectedPosition.token.formatUnits(this.amountOutInWstEthBN)
  }

  get priceBN(): BigNumber | undefined {
    if (this.amountOutInWstEthBN === undefined || this.root.closeTradeStore.amountBN === undefined)
      return undefined
    if (this.root.closeTradeStore.amountBN.eq(0)) return BigNumber.from(0)

    return safeDiv(
      this.amountOutInWstEthBN.mul(WEI_DENOMINATOR),
      this.root.closeTradeStore.amountBN
    )
  }

  // this price can be number because it's only used for estimated calculation and never require precise calculation
  get price(): number | undefined {
    if (this.inputValue === '') return this.selectedPosition?.priceInWstEth
    if (this.priceBN === undefined || this.selectedPosition === undefined) return undefined

    const price = this.selectedPosition.token.formatUnits(this.priceBN)
    if (price === undefined) return undefined
    return +price
  }

  get valuation(): number | undefined {
    const { direction } = this.root.tradeStore
    if (!this.selectedPosition || this.price === undefined) return undefined
    const { payoutRange, valuationRange } = this.selectedPosition.market
    if (payoutRange === undefined || valuationRange === undefined) return undefined

    const longTokenPrice = direction === 'long' ? this.price : 1 - this.price

    return calculateValuation({
      longTokenPrice,
      payoutRange,
      valuationRange,
    })
  }

  // pnl per token = currentPrice - costPerToken
  get pnlAmount(): number | undefined {
    if (this.valueByCostBasis === undefined || this.amountOut === undefined) return undefined
    // the closePositionAmountOut is the actual USD amount user will receive
    // hence, subtract the original spent amount on the closing portion, we get the pnl amount
    return +this.amountOut - this.valueByCostBasis
  }

  // this is the USD amount user original spent on the closing portion
  get valueByCostBasis(): number | undefined {
    if (
      this.root.closeTradeStore.amount === undefined ||
      this.selectedPosition?.costBasis === undefined
    )
      return undefined
    return +this.root.closeTradeStore.amount * this.selectedPosition.costBasis
  }

  // actions

  private closeOrRedeemPosition(permit: SignedPermit): UnsignedTxOutput {
    return this.selectedMarket?.resolved ? this.redeemPosition() : this.closePosition(permit)
  }

  private closePosition(permit: SignedPermit): UnsignedTxOutput {
    const { address: addressOfSigner } = this.root.web3Store

    if (
      !this.selectedPosition ||
      this.amountBN === undefined ||
      this.amountOutInWstEthBN === undefined ||
      addressOfSigner === undefined
    )
      return {
        success: false,
        error: 'Something went wrong, try again later.',
      }

    return this.root.depositTradeHelperStore.createTradeForCollateralTx({
      collateralAmountOut: this.amountOutInWstEthBN,
      permit,
      positionToken: this.selectedPosition.token,
      positionTokenAmount: this.amountBN,
      recipient: addressOfSigner,
    })
  }

  private redeemPosition(): UnsignedTxOutput {
    const { direction } = this.root.tradeStore
    const { address } = this.root.web3Store

    if (
      address === undefined ||
      this.selectedPosition === undefined ||
      this.selectedMarket === undefined ||
      this.selectedPosition.token.balanceOfSigner === undefined
    )
      return {
        success: false,
        error: TransactionBundleStore.UNEXPECTED_ERROR,
      }

    const {
      token: { balanceOfSigner },
    } = this.selectedPosition

    return this.selectedMarket.createRedeemTx(
      direction === 'long' ? balanceOfSigner : BigNumber.from(0),
      direction === 'short' ? balanceOfSigner : BigNumber.from(0),
      address
    )
  }

  private handleAfterTransactionSuccess({
    hash,
    type,
  }: {
    hash: string
    type: 'approval' | 'action'
  }): void {
    let message = 'Position Closed'

    if (type === 'approval') {
      message = 'Approved Tokens for Trade'
    } else if (this.selectedMarket?.resolved) {
      message = 'Position Redeemed'
    }

    toast.success(message, { link: this.root.web3Store.getBlockExplorerUrl(hash) })

    this.reset()
  }

  private handleError({ error, hash }: { error: string; hash?: string }): void {
    toast.error(this.selectedMarket?.resolved ? 'Redeem Failed' : 'Trade Failed', {
      description: error,
      link: hash ? this.root.web3Store.getBlockExplorerUrl(hash) : undefined,
    })
  }

  get priceImpact(): number | undefined {
    if (!this.selectedPosition || this.selectedMarket?.resolved) return 0

    if (this.amount === undefined || this.amountOut === undefined) return undefined

    const priceImpact = this.selectedPosition.getPriceImpact(+this.amountOut, +this.amount, true)

    return priceImpact
  }

  get gasCostBN(): BigNumber | undefined {
    return this.root.gasStore.maxFeePerGas?.mul(CloseTradeStore.GAS_LIMIT)
  }
}
