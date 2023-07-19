import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { DUST_THRESHOLD, getBalanceLimitInfo } from '../balance-limits'

describe('getBalanceLimitInfo', () => {
  const bn = (n: number): BigNumber => BigNumber.from(10).pow(18).mul(n)

  describe('not-exceeded', () => {
    it('returns not-exceeded if current amount plus additional amount is less than or equal to the cap', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: bn(25),
        cap: bn(100),
        currentAmount: bn(50),
      })

      if (result.status !== 'not-exceeded') {
        throw new Error('Invalid status')
      }

      expect(result.amountEth).toBe('50.0')
      expect(result.capEth).toBe('100.0')
      expect(result.remainingEth).toBe('50.0')
    })

    it('returns not-exceeded if current amount plus additional amount is below the cap but above the dust threshold', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: DUST_THRESHOLD.mul(3).div(2),
        cap: parseEther('100'),
        currentAmount: parseEther('100').sub(DUST_THRESHOLD.mul(2)),
      })

      if (result.status !== 'not-exceeded') {
        throw new Error('Invalid status')
      }

      expect(result.amountEth).toBe('99.999800000000000002')
      expect(result.capEth).toBe('100.0')
      expect(result.remainingEth).toBe('0.000199999999999998')
    })
  })

  describe('already-exceeded', () => {
    it('returns already-exceeded if current amount is greater than the cap', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: bn(0),
        cap: bn(100),
        currentAmount: bn(120),
      })

      if (result.status !== 'already-exceeded') {
        throw new Error('Invalid status')
      }

      expect(result.amountEth).toBe('120.0')
      expect(result.capEth).toBe('100.0')
      expect(result.remainingEth).toBe('0.0')
    })

    it('returns already-exceeded if current amount is equal to the cap', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: bn(0),
        cap: bn(100),
        currentAmount: bn(100),
      })

      if (result.status !== 'already-exceeded') {
        throw new Error('Invalid status')
      }

      expect(result.amountEth).toBe('100.0')
      expect(result.capEth).toBe('100.0')
      expect(result.remainingEth).toBe('0.0')
    })

    it('returns already-exceeded if the dust threshold is exceeded', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: bn(0),
        cap: bn(100),
        currentAmount: bn(100).sub(parseEther('0.00009')),
      })

      if (result.status !== 'already-exceeded') {
        throw new Error('Invalid status')
      }

      expect(result.amountEth).toBe('99.99991')
      expect(result.capEth).toBe('100.0')
      expect(result.remainingEth).toBe('0.00009')
    })

    it('returns already-exceeded if current amount is equal to the cap and additional amount is greater than zero', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: bn(25),
        cap: bn(100),
        currentAmount: bn(100),
      })

      if (result.status !== 'already-exceeded') {
        throw new Error('Invalid status')
      }

      expect(result.amountEth).toBe('100.0')
      expect(result.capEth).toBe('100.0')
      expect(result.remainingEth).toBe('0.0')
    })
  })

  describe('exceeded-after-transfer', () => {
    it('returns exceeded-after-transfer if current amount plus additional amount is greater than the cap', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: bn(25),
        cap: bn(100),
        currentAmount: bn(80),
      })

      if (result.status !== 'exceeded-after-transfer') {
        throw new Error('Invalid status')
      }

      expect(result.amountEth).toBe('80.0')
      expect(result.capEth).toBe('100.0')
      expect(result.remainingEth).toBe('20.0')
    })
  })

  describe('loading', () => {
    it('should return loading when any parameter is undefined', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: bn(50),
        cap: undefined,
        currentAmount: bn(100),
      })

      expect(result.status).toEqual('loading')
    })
  })
})
