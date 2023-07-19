/* eslint-disable @typescript-eslint/no-explicit-any */
import { configure } from 'mobx'
import { parseUnits } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import { DateTimeInMs, DurationInMs } from '../../../utils/date-types'

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global
const amountToWithdraw = '1000.0'
const COLLATERAL_BALANCE = '2000'
const COLLATERAL_DECIMALS = 18

describe('WithdrawStore tests', () => {
  let spyCollateralBalanceOfSigner: jest.SpyInstance
  let spyCollateralDecimalsNumber: jest.SpyInstance
  let spyGlobalAmountWithdrawnThisPeriod: jest.SpyInstance
  let spyGlobalPeriodLength: jest.SpyInstance
  let spyGlobalWithdrawLimitPerPeriod: jest.SpyInstance
  let spyLastGlobalPeriodReset: jest.SpyInstance
  beforeAll(() => {
    const COLLATERAL_BALANCE_BIGNUMBER = parseUnits(`${COLLATERAL_BALANCE}`, COLLATERAL_DECIMALS)

    spyCollateralBalanceOfSigner = jest
      .spyOn(rootStore.collateralStore, 'balanceOfSigner', 'get')
      .mockReturnValue(COLLATERAL_BALANCE_BIGNUMBER)

    spyCollateralDecimalsNumber = jest
      .spyOn(rootStore.collateralStore, 'decimalsNumber', 'get')
      .mockReturnValue(COLLATERAL_DECIMALS)

    spyGlobalAmountWithdrawnThisPeriod = jest
      .spyOn(rootStore.collateralStore.withdrawHook, 'globalAmountWithdrawnThisPeriod', 'get')
      .mockReturnValue(BigNumber.from(0))

    spyGlobalPeriodLength = jest
      .spyOn(rootStore.collateralStore.withdrawHook, 'globalPeriodLength', 'get')
      .mockReturnValue((24 * 60 * 60) as DurationInMs)

    spyGlobalWithdrawLimitPerPeriod = jest
      .spyOn(rootStore.collateralStore.withdrawHook, 'globalWithdrawLimitPerPeriod', 'get')
      .mockReturnValue(BigNumber.from(10).pow(18).mul(100))

    spyLastGlobalPeriodReset = jest
      .spyOn(rootStore.collateralStore.withdrawHook, 'lastGlobalPeriodReset', 'get')
      .mockReturnValue(0 as DateTimeInMs)
  })

  afterAll(() => {
    spyCollateralBalanceOfSigner.mockRestore()
    spyCollateralDecimalsNumber.mockRestore()
    spyGlobalAmountWithdrawnThisPeriod.mockRestore()
    spyGlobalPeriodLength.mockRestore()
    spyGlobalWithdrawLimitPerPeriod.mockRestore()
    spyLastGlobalPeriodReset.mockRestore()
  })

  it('should set the amount', () => {
    rootStore.withdrawStore.setWithdrawalAmount(amountToWithdraw)
    expect(rootStore.withdrawStore.withdrawalAmountInput).toBe(amountToWithdraw)
  })

  it('should disable button if amount is larger than balance', () => {
    rootStore.withdrawStore.setWithdrawalAmount('2000.5')
    expect(rootStore.withdrawStore.withdrawalDisabled).toBe(true)
  })
})
