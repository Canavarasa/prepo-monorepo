import { BigNumber } from 'ethers'
import { isProduction } from './isProduction'

export const safeDiv = (a: BigNumber | number, b: BigNumber | number): BigNumber => {
  const aBN = BigNumber.from(a)
  const bBN = BigNumber.from(b)
  if (bBN.isZero()) {
    if (!isProduction) throw new Error('Cannot divide by zero')
    // eslint-disable-next-line no-console
    console.error('Cannot divide by zero')
    return BigNumber.from(0)
  }
  return aBN.div(bBN)
}
