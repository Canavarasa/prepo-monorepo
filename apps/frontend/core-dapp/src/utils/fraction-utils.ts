import { BigNumber } from 'ethers'
import { isProduction } from './isProduction'
import { safeDiv } from './safeDiv'

export type Fraction = [BigNumber, BigNumber] & {
  // This ensures that fractions can't be created without the fraction function
  __: never
}

export function greatestCommonDivisor(a: BigNumber, b: BigNumber): BigNumber {
  if (b.eq(BigNumber.from(0))) {
    return a
  }

  return greatestCommonDivisor(b, a.mod(b))
}

export function lowestCommonMultiple(a: BigNumber, b: BigNumber): BigNumber {
  if (a.isZero() || b.isZero()) {
    return BigNumber.from(0)
  }

  const product = a.mul(b)
  const gcd = greatestCommonDivisor(a, b)
  return safeDiv(product, gcd)
}

export function fraction(num: BigNumber, den: BigNumber): Fraction {
  if (den.eq(0)) {
    const error = new Error("Denominator can't be zero")

    if (isProduction) {
      // eslint-disable-next-line no-console
      console.warn(error)
      return fraction(BigNumber.from(0), BigNumber.from(1))
    }

    throw error
  }

  // Simplify the fraction so that we can use toPercent without worrying about
  // Javascript number overflows
  const commonDivisor = greatestCommonDivisor(num, den)
  return [safeDiv(num, commonDivisor), safeDiv(den, commonDivisor)] as Fraction
}

export function mul(number: BigNumber, [num, den]: Fraction): BigNumber {
  return safeDiv(number.mul(num), den)
}

export function div(number: BigNumber, [num, den]: Fraction): BigNumber {
  return mul(number, [den, num] as Fraction)
}

export function sub([aNum, aDen]: Fraction, [bNum, bDen]: Fraction): Fraction {
  const commonDen = lowestCommonMultiple(aDen, bDen)

  const aNumNext = aNum.mul(safeDiv(commonDen, aDen))
  const bNumNext = bNum.mul(safeDiv(commonDen, bDen))

  return fraction(aNumNext.sub(bNumNext), commonDen)
}

const MAX_SAFE_INTEGER_BN = BigNumber.from(Number.MAX_SAFE_INTEGER.toString())

export function toPercent([num, den]: Fraction): number {
  let safeNum = num
  let safeDen = den

  // If the BigNumbers are not safe to cast to number, remove digits until they
  // are. This loses precision but it is negligible.
  while (safeNum.gt(MAX_SAFE_INTEGER_BN) || safeDen.gt(MAX_SAFE_INTEGER_BN)) {
    safeNum = safeDiv(safeNum, 10)
    safeDen = safeDiv(safeDen, 10)
  }

  return safeNum.toNumber() / safeDen.toNumber()
}
