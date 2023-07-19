import { BigNumber } from 'ethers'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { makeAutoObservable } from 'mobx'
import addDays from 'date-fns/fp/addDays'
import { RootStore } from './RootStore'
import { ExactTokenInForTokenOutProps, exactTokenInForTokenOut } from '../utils/balancer-math'
import { safeDiv } from '../utils/safeDiv'

export type Quote = {
  priceImpact: number
  value: BigNumber
}

type ConvertibleUtilityValues = {
  inWstEthString: string
  inWstEth: number
  inEthString: string
  inEth: number
}

export type EthConvertible = {
  inWstEthBN: BigNumber
  inEthBN: BigNumber
  priceImpact: number
} & ConvertibleUtilityValues

const makeConvertibleUtilityValues = (
  ethAmount: BigNumber,
  wstEthAmount: BigNumber
): ConvertibleUtilityValues => {
  const inWstEthString = formatEther(wstEthAmount)
  const inWstEth = parseFloat(inWstEthString)
  const inEthString = formatEther(ethAmount)
  const inEth = parseFloat(inEthString)
  return { inWstEthString, inWstEth, inEthString, inEth }
}

const getTradeDeadlineFromDate = addDays(1)

export class BalancerStore {
  constructor(private readonly root: RootStore) {
    makeAutoObservable(this)

    this.loadWethDecimals()
  }

  private get wstEthWethPoolData():
    | Omit<ExactTokenInForTokenOutProps, 'tokenIndexIn' | 'tokenIndexOut' | 'amount'>
    | undefined {
    const { allTokens, amplificationParameter, swapFeePercentage } = this.root.wstEthWethPool

    if (
      amplificationParameter === undefined ||
      swapFeePercentage === undefined ||
      allTokens === undefined
    )
      return undefined

    return {
      amp: amplificationParameter.value,
      swapFee: swapFeePercentage,
      tokens: allTokens,
      tokenInDecimals: 18, // this object is specifically for wstETH/WETH pool, which both tokens use 18 decimals
    }
  }

  get loading(): boolean {
    const { wstEthWethPoolData } = this
    const { wethAddress, wstEthAddress } = this
    const { decimalsNumber: wethDecimals } = this.root.wethStore

    return (
      wethAddress === undefined ||
      wstEthAddress === undefined ||
      wethDecimals === undefined ||
      wstEthWethPoolData === undefined
    )
  }

  get defaultWstEthToWethRate(): BigNumber | undefined {
    if (this.wstEthWethPoolData === undefined) return undefined
    const amount = parseEther('1')
    const outputOut = exactTokenInForTokenOut({
      ...this.wstEthWethPoolData,
      tokenIndexIn: 0,
      tokenIndexOut: 1,
      amount,
    })

    // calculate rate for 1 wstETH
    return safeDiv(outputOut.mul(parseEther('1')), amount)
  }

  get defaultWethToWstEthRate(): BigNumber | undefined {
    if (this.defaultWstEthToWethRate === undefined) return undefined
    return safeDiv(parseEther('1').mul(parseEther('1')), this.defaultWstEthToWethRate)
  }

  /* Converts exact wstETH amount to ETH using actual executable rate, slippage excluded. */
  getWstEthAmountInEth(wstEthAmount: BigNumber): BigNumber | undefined {
    try {
      if (wstEthAmount.eq(0)) return BigNumber.from(0)

      const { tokens } = this.root.wstEthWethPool
      if (this.wstEthWethPoolData === undefined || tokens === undefined) return undefined

      const wstEthToken = tokens[0]
      if (wstEthToken.priceRate === undefined) return undefined

      return exactTokenInForTokenOut({
        ...this.wstEthWethPoolData,
        tokenIndexIn: 0,
        tokenIndexOut: 1,
        amount: wstEthAmount,
      })
    } catch (e) {
      // exactTokenInForTokenOut will throw error when amount is too small to compute
      // use a static rate as a fallback
      if (this.defaultWstEthToWethRate === undefined) return undefined
      return wstEthAmount.mul(this.defaultWstEthToWethRate).div(parseEther('1'))
    }
  }

  getWstEthAmountInEthWithPriceImpact(wstEthAmount: BigNumber): Quote | undefined {
    if (wstEthAmount.eq(0)) return { value: BigNumber.from(0), priceImpact: 0 }

    const value = this.getWstEthAmountInEth(wstEthAmount)

    if (value === undefined || this.wstEthToWethSpotPrice === undefined) return undefined

    if (value.eq(0)) return { value: BigNumber.from(0), priceImpact: 0 }
    const swapPrice = +formatEther(safeDiv(wstEthAmount.mul(parseEther('1')), value))
    const priceDifference = swapPrice - this.wstEthToWethSpotPrice
    const priceImpact = priceDifference / this.wstEthToWethSpotPrice

    return { value, priceImpact }
  }

  /*  Converts exact ETH amount to wstETH using actual executable rate, slippage excluded. */
  getEthAmountInWstEth(ethAmount: BigNumber): BigNumber | undefined {
    try {
      if (ethAmount.eq(0)) return BigNumber.from(0)

      const { tokens } = this.root.wstEthWethPool
      if (this.wstEthWethPoolData === undefined || tokens === undefined) return undefined

      const wstEthToken = tokens[0]
      if (wstEthToken.priceRate === undefined) return undefined

      return exactTokenInForTokenOut({
        ...this.wstEthWethPoolData,
        tokenIndexIn: 1,
        tokenIndexOut: 0,
        amount: ethAmount,
      })
    } catch (e) {
      // exactTokenInForTokenOut will throw error when amount is too small to compute
      // use a static rate as a fallback
      if (this.defaultWethToWstEthRate === undefined) return undefined
      return ethAmount.mul(this.defaultWethToWstEthRate).div(parseEther('1'))
    }
  }

  getEthAmountInWstEthWithPriceImpact(ethAmount: BigNumber): Quote | undefined {
    if (ethAmount.eq(0)) return { value: BigNumber.from(0), priceImpact: 0 }

    const value = this.getEthAmountInWstEth(ethAmount)

    if (value === undefined || this.wethToWstEthSpotPrice === undefined) return undefined

    if (value.eq(0)) return { value: BigNumber.from(0), priceImpact: 0 }
    const swapPrice = +formatEther(safeDiv(ethAmount.mul(parseEther('1')), value))
    const priceDifference = swapPrice - this.wethToWstEthSpotPrice
    const priceImpact = priceDifference / this.wethToWstEthSpotPrice

    return { value, priceImpact }
  }

  getConvertibleFromEth(inEthBN: BigNumber): EthConvertible | undefined {
    const wstEthOutput = this.getEthAmountInWstEthWithPriceImpact(inEthBN)
    if (wstEthOutput === undefined) return undefined
    const { value: inWstEthBN, priceImpact } = wstEthOutput
    const convertibles = makeConvertibleUtilityValues(inEthBN, inWstEthBN)
    return {
      ...convertibles,
      priceImpact,
      inEthBN,
      inWstEthBN,
    }
  }

  getConvertibleFromWstEth(inWstEthBN: BigNumber): EthConvertible | undefined {
    const ethOutput = this.getWstEthAmountInEthWithPriceImpact(inWstEthBN)
    if (ethOutput === undefined) return undefined
    const { value: inEthBN, priceImpact } = ethOutput
    const convertibles = makeConvertibleUtilityValues(inEthBN, inWstEthBN)
    return {
      ...convertibles,
      priceImpact,
      inEthBN,
      inWstEthBN,
    }
  }

  private get wstEthAddress(): string | undefined {
    const { address } = this.root.baseTokenStore
    return address
  }

  private get wethAddress(): string | undefined {
    const { address } = this.root.wethStore
    return address
  }

  // Necessary so that quoteEthAmountInWstEth works
  private loadWethDecimals(): void {
    this.root.wethStore.decimals()
  }

  // not exactly spot price but since we dont know how to get a metastable pool's spot price, this is close enough
  private get wstEthToWethSpotPrice(): number | undefined {
    const tradeAmount = parseEther('0.001')
    const wethOut = this.getWstEthAmountInEth(tradeAmount)
    if (wethOut === undefined) return undefined
    return +formatEther(safeDiv(tradeAmount.mul(parseEther('1')), wethOut))
  }

  private get wethToWstEthSpotPrice(): number | undefined {
    const tradeAmount = parseEther('0.001')
    const wstEthOut = this.getEthAmountInWstEth(tradeAmount)
    if (wstEthOut === undefined) return undefined
    return +formatEther(safeDiv(tradeAmount.mul(parseEther('1')), wstEthOut))
  }

  /*
   * Generates a timestamp to mark the deadline of a trade. This timestamp is
   * submitted to the blockchain, and if the transaction confirms after it, the
   * trade reverts.
   */
  static getTradeDeadline(): BigNumber {
    return BigNumber.from(getTradeDeadlineFromDate(Date.now()).getTime()).div(1000)
  }
}
