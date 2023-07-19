/* eslint-disable @typescript-eslint/naming-convention */
import { BigNumber } from '@ethersproject/bignumber'
import * as BalancerSDK from '@georgeroman/balancer-v2-pools'
import { BigNumber as OldBigNumber } from 'bignumber.js'
import { parseEther } from 'ethers/lib/utils'
import { safeDiv } from './safeDiv'

OldBigNumber.config({
  EXPONENTIAL_AT: [-100, 100],
  ROUNDING_MODE: 1,
  DECIMAL_PLACES: 18,
})

export type MetaStablePoolTokenProps = {
  priceRate: BigNumber
  balance: BigNumber
}

function bnum(val: string | number | OldBigNumber): OldBigNumber {
  return new OldBigNumber(val.toString())
}

export type ExactTokenInForTokenOutProps = {
  tokens: MetaStablePoolTokenProps[]
  amp: BigNumber
  swapFee: BigNumber
  tokenIndexIn: number
  tokenIndexOut: number
  amount: BigNumber
  tokenInDecimals: number
}

// to learn more about MetaStablePool math, see:
// https://github.com/balancer/balancer-sor/blob/9059705624d9be5b20ed00e9cee4cffceca43044/src/pools/metaStablePool/metaStablePool.ts#L205
export const exactTokenInForTokenOut = ({
  tokens,
  amp,
  swapFee,
  tokenIndexIn,
  tokenIndexOut,
  amount,
  tokenInDecimals,
}: ExactTokenInForTokenOutProps): BigNumber => {
  const tokenIn = tokens[tokenIndexIn]
  const tokenOut = tokens[tokenIndexOut]

  const amountConverted = amount.mul(tokenIn.priceRate).div(parseEther('1')).toString()

  const outputBN = BalancerSDK.StableMath._calcOutGivenIn(
    bnum(amp.toString()),
    tokens.map(({ balance }) => bnum(balance.toString())),
    tokenIndexIn,
    tokenIndexOut,
    bnum(amountConverted.toString()),
    {
      swapFeePercentage: bnum(swapFee.toString()),
      tokenInDecimals,
    }
  )

  const outputConverted = safeDiv(
    BigNumber.from(outputBN.toString()).mul(parseEther('1')),
    tokenOut.priceRate
  )

  return outputConverted
}
