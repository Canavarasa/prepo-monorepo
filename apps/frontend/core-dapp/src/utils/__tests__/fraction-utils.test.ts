import { BigNumber } from 'ethers'
import { greatestCommonDivisor, lowestCommonMultiple } from '../fraction-utils'

describe('greatestCommonDivisor', () => {
  it('calculates the greatest common divisor of 48 and 18', () => {
    const result = greatestCommonDivisor(BigNumber.from(48), BigNumber.from(18))
    expect(result).toEqual(BigNumber.from(6))
  })

  it('calculates the greatest common divisor of 14 and 28', () => {
    const result = greatestCommonDivisor(BigNumber.from(14), BigNumber.from(28))
    expect(result).toEqual(BigNumber.from(14))
  })

  it('calculates the greatest common divisor of 21 and 14', () => {
    const result = greatestCommonDivisor(BigNumber.from(21), BigNumber.from(14))
    expect(result).toEqual(BigNumber.from(7))
  })

  it('calculates the greatest common divisor of 0 and 5', () => {
    const result = greatestCommonDivisor(BigNumber.from(0), BigNumber.from(5))
    expect(result).toEqual(BigNumber.from(5))
  })

  it('calculates the greatest common divisor of 5 and 0', () => {
    const result = greatestCommonDivisor(BigNumber.from(5), BigNumber.from(0))
    expect(result).toEqual(BigNumber.from(5))
  })
})

describe('lowestCommonMultiple', () => {
  it('calculates the least common multiple of 12 and 18', () => {
    const result = lowestCommonMultiple(BigNumber.from(12), BigNumber.from(18))
    expect(result).toEqual(BigNumber.from(36))
  })

  it('calculates the least common multiple of 14 and 28', () => {
    const result = lowestCommonMultiple(BigNumber.from(14), BigNumber.from(28))
    expect(result).toEqual(BigNumber.from(28))
  })

  it('calculates the least common multiple of 21 and 14', () => {
    const result = lowestCommonMultiple(BigNumber.from(21), BigNumber.from(14))
    expect(result).toEqual(BigNumber.from(42))
  })

  it('calculates the least common multiple of 0 and 5', () => {
    const result = lowestCommonMultiple(BigNumber.from(0), BigNumber.from(5))
    expect(result).toEqual(BigNumber.from(0))
  })

  it('calculates the least common multiple of 5 and 0', () => {
    const result = lowestCommonMultiple(BigNumber.from(5), BigNumber.from(0))
    expect(result).toEqual(BigNumber.from(0))
  })

  it('calculates the least common multiple of 6 and 12 (latter is multiple of former)', () => {
    const result = lowestCommonMultiple(BigNumber.from(6), BigNumber.from(12))
    expect(result).toEqual(BigNumber.from(12))
  })
})
