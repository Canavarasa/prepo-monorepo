import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { makeAutoObservable, reaction, runInAction } from 'mobx'
import { toast } from 'prepo-ui'
import { validateStringToBN } from 'prepo-utils'
import { RootStore } from '../../../stores/RootStore'
import { MarketEntity } from '../../../stores/entities/MarketEntity'
import { PositionEntity } from '../../../stores/entities/Position.entity'
import { DepositLimit, getDepositLimit } from '../../../utils/balance-limits'
import { Token, TokensStore } from '../../../stores/TokensStore'
import { EthConvertible } from '../../../stores/BalancerStore'
import { calculateValuation } from '../../../utils/market-utils'
import { TransactionBundleStore } from '../../../stores/TransactionBundleStore'
import { SignedPermit } from '../../../stores/entities/Erc20Permit.entity'
import { UnsignedTxOutput } from '../../../types/transaction.types'

export class OpenTradeStore {
  private static readonly DEPOSIT_AND_TRADE_GAS_LIMIT = 3_500_000
  private static readonly TRADE_GAS_LIMIT = 2_500_000

  input: { type: 'max' } | { type: 'input'; value: string } = {
    type: 'input',
    value: '',
  }
  longShortAmountBN?: BigNumber = undefined
  private paymentTokenOverride?: Token = undefined

  readonly transactionBundle = new TransactionBundleStore({
    actionNames: () => (this.paymentToken.type === 'native' ? ['Deposit', 'Trade'] : ['Trade']),
    actionTxCreator: this.openTrade.bind(this),
    root: this.root,
    onAfterTransactionSuccess: this.handleAfterTransactionSuccess.bind(this),
    onError: this.handleError.bind(this),
    requiredApproval: () => ({
      amount: this.amount?.inWstEthBN,
      spender: 'DEPOSIT_TRADE_HELPER',
      token: this.root.collateralStore,
    }),
  })

  constructor(private readonly root: RootStore) {
    this.subscribeOpenTradeAmountOut()
    makeAutoObservable(this, {}, { autoBind: true })
  }

  private subscribeOpenTradeAmountOut(): void {
    reaction(
      () => ({
        position: this.selectedPosition,
        quoteAmountBN: this.amount?.inWstEthBN,
        marketValuation: this.selectedMarket?.estimatedValuation,
        fee: this.selectedPosition?.pool.poolImmutables?.fee,
      }),
      async ({ quoteAmountBN, position, fee }) => {
        const { address: collateralAddress } = this.root.collateralStore

        if (
          quoteAmountBN === undefined ||
          !collateralAddress ||
          !position?.token.address ||
          fee === undefined
        )
          return

        const output = await this.root.swapStore.quoteExactInput({
          amountBN: quoteAmountBN,
          fromAddress: collateralAddress,
          toAddress: position.token.address,
          fee,
        })

        runInAction(() => {
          const shouldNotUpdate =
            output === undefined ||
            this.amount === undefined ||
            !output.cachedInAmount.eq(this.amount?.inWstEthBN)

          if (shouldNotUpdate) return
          this.longShortAmountBN = output.output
        })
      }
    )
  }

  // payment token

  get paymentToken(): Token {
    return this.paymentTokenOverride ?? this.root.tokensStore.sortedTradeTokens[0]
  }

  setPaymentTokenOverride(token: Token): void {
    this.paymentTokenOverride = token
  }

  get selectedMarket(): MarketEntity | undefined {
    return this.root.tradeStore.selectedMarket
  }

  get selectedPosition(): PositionEntity | undefined {
    return this.root.tradeStore.selectedPosition
  }

  // user input

  reset(): void {
    this.longShortAmountBN = undefined
    this.setInput('')
  }

  setInput(amount: string): void {
    if (validateStringToBN(amount)) {
      this.longShortAmountBN = undefined
      this.input =
        amount === this.tradingBalanceAfterGas ? { type: 'max' } : { type: 'input', value: amount }

      // pin the payment token so it doesnt change by default behaviour - highest balance
      this.paymentTokenOverride = this.paymentToken
    }
  }

  get controlledInput(): string {
    if (this.selectedMarket?.resolved) return ''

    if (this.input.type === 'max') return this.tradingBalanceAfterGas ?? ''

    return this.input.value
  }

  // input amounts

  get amount(): EthConvertible | undefined {
    if (this.controlledInput === '')
      return this.root.balancerStore.getConvertibleFromEth(BigNumber.from(0))

    if (this.input.type === 'max') {
      // use the actual collateral balance  instead of converting from wstETH -> ETH -> wstETH
      if (this.paymentToken.type === 'preWstEth') return this.paymentToken.erc20.balance

      if (this.paymentToken.type === 'native') {
        if (this.tradingBalanceAfterGasBN === undefined) return undefined
        return this.root.balancerStore.getConvertibleFromEth(this.tradingBalanceAfterGasBN)
      }
    }

    const inputBN = TokensStore.parseUnits(this.paymentToken, this.controlledInput)
    if (inputBN === undefined) return undefined
    return this.root.balancerStore.getConvertibleFromEth(inputBN)
  }

  // output amounts

  get longShortAmount(): string | undefined {
    // amountOut will always be 0 if input is 0
    if (this.longShortAmountBN?.eq(0)) return '0'
    if (!this.selectedMarket || this.longShortAmountBN === undefined) return undefined
    const token = this.selectedPosition?.token
    return token?.formatUnits(this.longShortAmountBN)
  }

  // trading balance after gas

  get tradingBalanceAfterGas(): string | undefined {
    if (this.tradingBalanceAfterGasBN === undefined) return undefined
    return formatEther(this.tradingBalanceAfterGasBN)
  }

  get tradingBalanceAfterGasBN(): BigNumber | undefined {
    if (this.paymentToken.type === 'native')
      return this.root.web3Store.signerState.balance?.sub(this.gasCostBN ?? 0)

    return this.root.tokensStore.getTokenBalanceBN(this.paymentToken)
  }

  get tradingValuation(): number | undefined {
    if (this.selectedMarket === undefined || this.price === undefined) return undefined
    const { payoutRange, valuationRange } = this.selectedMarket
    if (!valuationRange || !payoutRange) return undefined

    return calculateValuation({
      longTokenPrice: this.price,
      payoutRange,
      valuationRange,
    })
  }

  get slippage(): number {
    const { slippageForDeposits, slippageForTrades } = this.root.advancedSettingsStore
    if (this.paymentToken.type === 'native')
      return 1 - (1 - slippageForDeposits) * (1 - slippageForTrades)

    return slippageForTrades
  }

  get depositLimit(): DepositLimit {
    // deposit limit only applies to native tokens
    if (this.paymentToken.type !== 'native') return { status: 'not-exceeded' }

    return getDepositLimit({
      connected: this.root.web3Store.connected,
      depositAmount: this.amount?.inEthBN,
      depositRecordStore: this.root.depositRecordStore,
      isNetworkSupported: this.root.web3Store.isNetworkSupported,
    })
  }

  get price(): number | undefined {
    if (this.longShortAmount === undefined || this.amount === undefined) return undefined

    // input is zero, use spot price
    if (+this.longShortAmount === 0 || this.amount.inEthBN.eq(0))
      return this.selectedPosition?.priceInWstEth

    const price = this.amount.inWstEth / +this.longShortAmount
    return this.root.tradeStore.direction === 'long' ? price : 1 - price
  }

  get disabled(): boolean {
    // only if input is greater than 0
    const loadingValuationPrice =
      Boolean(this.amount?.inWstEthBN?.gt(0)) && this.longShortAmountBN === undefined

    return Boolean(
      !this.selectedMarket ||
        !this.amount ||
        this.amount.inWstEthBN.eq(0) ||
        !this.withinBounds ||
        this.insufficientBalance ||
        this.selectedMarket.resolved ||
        this.depositLimit.status !== 'not-exceeded' ||
        this.transactionBundle.initialLoading ||
        this.transactionBundle.transacting ||
        loadingValuationPrice
    )
  }

  get insufficientBalance(): boolean | undefined {
    if (!this.root.web3Store.connected) return false

    const balance = this.root.tokensStore.getTokenBalanceBN(this.paymentToken)

    if (balance === undefined || this.amount === undefined) return undefined
    return this.amount.inEthBN.gt(balance)
  }

  // initial loading states can only be true if user has interacted with input
  get initialLoading(): boolean {
    const emptyInput = this.input.type === 'input' && this.input.value === ''

    if (emptyInput) return false
    const loadingMarketExpiry = !!this.selectedMarket && this.selectedMarket.resolved === undefined

    return (
      this.transactionBundle.initialLoading ||
      !this.amount ||
      this.insufficientBalance === undefined ||
      !this.root.collateralStore.permitReady ||
      loadingMarketExpiry
    )
  }

  get loading(): boolean {
    const loadingBalance =
      this.root.web3Store.connected &&
      this.root.tokensStore.getTokenBalanceBN(this.paymentToken) === undefined

    // initial loading states is only activated when a market is selected and user has enough balance
    const initialLoadingActivated = Boolean(
      this.selectedMarket && !this.insufficientBalance && this.initialLoading
    )

    return this.transactionBundle.transacting || loadingBalance || initialLoadingActivated
  }

  get withinBounds(): boolean | undefined {
    if (this.selectedMarket === undefined || this.selectedMarket.payoutRange === undefined)
      return undefined

    if (this.selectedMarket.resolved) return true

    const { payoutRange } = this.selectedMarket
    const [lowerBound, upperBound] = payoutRange

    // don't allow opening trade if static price is already out of bound
    if (this.selectedPosition?.priceInWstEth === undefined) return undefined
    if (
      this.selectedPosition.priceInWstEth >= upperBound ||
      this.selectedPosition.priceInWstEth <= lowerBound
    )
      return false

    if (this.amount?.inEthBN.eq(0)) return true
    if (this.price === undefined) return undefined

    return this.price > lowerBound && this.price < upperBound
  }

  // price impacts

  get depositPriceImpact(): number | undefined {
    if (this.paymentToken.type === 'preWstEth') return 0
    return this.amount?.priceImpact
  }

  get tradePriceImpact(): number | undefined {
    if (this.selectedPosition === undefined) return 0
    if (this.amount === undefined || this.longShortAmount === undefined) return undefined

    return this.selectedPosition.getPriceImpact(this.amount.inWstEth, +this.longShortAmount)
  }

  get priceImpact(): number | undefined {
    if (this.tradePriceImpact === undefined || this.depositPriceImpact === undefined)
      return undefined

    return (1 + this.tradePriceImpact) * (1 + this.depositPriceImpact) - 1
  }

  get depositPriceImpactTooHigh(): boolean | undefined {
    if (this.depositPriceImpact === undefined) return undefined
    return this.root.advancedSettingsStore.isEthWstEthPriceImpactTooHigh(this.depositPriceImpact)
  }

  private openTrade(permit: SignedPermit): UnsignedTxOutput {
    const selectedToken = this.selectedPosition?.token

    if (
      !this.selectedMarket ||
      !selectedToken?.address ||
      this.root.web3Store.address === undefined ||
      this.longShortAmountBN === undefined ||
      !this.amount
    )
      return {
        success: false,
        error: 'Something went wrong, try again later.',
      }

    const collateralAmount = this.amount.inWstEthBN
    const recipient = this.root.web3Store.address
    const positionToken = selectedToken.address

    if (this.paymentToken.type === 'native') {
      return this.root.depositTradeHelperStore.createWrapAndDepositAndTradeTx({
        amountInEth: this.amount.inEthBN,
        expectedAmountInPositionToken: this.longShortAmountBN,
        expectedIntermediateAmountInWstEth: collateralAmount,
        permit,
        positionToken,
        recipient,
      })
    }

    return this.root.depositTradeHelperStore.createTradeForPositionTx({
      collateralAmount,
      permit,
      positionToken,
      positionTokenAmountOut: this.longShortAmountBN,
      recipient,
    })
  }

  private handleAfterTransactionSuccess({
    hash,
    type,
  }: {
    hash: string
    type: 'approval' | 'action'
  }): void {
    let message = 'Position Opened'

    if (type === 'approval') {
      message = 'Approved Tokens for Trade'
    } else if (this.paymentToken.type === 'native') {
      message = 'Deposit & Trade Confirmed'
    }

    toast.success(message, { link: this.root.web3Store.getBlockExplorerUrl(hash) })
    this.reset()
  }

  private handleError({ error, hash }: { error: string; hash?: string }): void {
    toast.error('Trade Failed', {
      description: error,
      link: hash ? this.root.web3Store.getBlockExplorerUrl(hash) : undefined,
    })
  }

  get gasCostBN(): BigNumber | undefined {
    return this.root.gasStore.maxFeePerGas?.mul(
      this.paymentToken.type === 'native'
        ? OpenTradeStore.DEPOSIT_AND_TRADE_GAS_LIMIT
        : OpenTradeStore.TRADE_GAS_LIMIT
    )
  }
}
