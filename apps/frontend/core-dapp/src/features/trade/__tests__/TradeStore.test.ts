/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { configure } from 'mobx'
// eslint-disable-next-line jest/no-mocks-import
import { poolMock } from '../../../__mocks__/test-mocks/pool.mock'

// TODO: remove this mock when we have functional market contract on arbitrum
jest.mock('../../../stores/entities/MarketEntity')

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global
const amountToTrade = '100'
const COLLATERAL_BALANCE = '2000'
const COLLATERAL_DECIMALS = 18

// eslint-disable-next-line jest/no-disabled-tests
describe.skip('TradeStore tests', () => {
  let spyCollateralDecimalsNumber: jest.SpyInstance
  let spyCollateralBalanceOfSigner: jest.SpyInstance
  beforeAll(() => {
    spyCollateralDecimalsNumber = jest
      .spyOn(rootStore.collateralStore, 'decimalsNumber', 'get')
      .mockReturnValue(COLLATERAL_DECIMALS)

    const COLLATERAL_BALANCE_BN = parseUnits(COLLATERAL_BALANCE, COLLATERAL_DECIMALS)

    spyCollateralBalanceOfSigner = jest
      .spyOn(rootStore.collateralStore, 'balanceOfSigner', 'get')
      .mockReturnValue(COLLATERAL_BALANCE_BN)
  })

  afterAll(() => {
    spyCollateralBalanceOfSigner.mockRestore()
    spyCollateralDecimalsNumber.mockRestore()
  })

  it('should initialize trade with long direction as default', () => {
    expect(rootStore.tradeStore.direction).toBe('long')
  })

  it('should select the amount to be traded', () => {
    rootStore.openTradeStore.setInput(amountToTrade)
    expect(rootStore.openTradeStore.controlledInput).toBe(amountToTrade)
  })

  it('should allow decimals input', () => {
    rootStore.openTradeStore.setInput('100.123')
    expect(rootStore.openTradeStore.controlledInput).toBe('100.123')
  })

  it('should disable button if amount is larger than balance', () => {
    const tradeAmount = '3000.50'
    rootStore.openTradeStore.setInput(tradeAmount)
    expect(rootStore.openTradeStore.controlledInput).toBe(tradeAmount)
    expect(rootStore.openTradeStore.disabled).toBe(true)
  })

  it('should not disable button if amount is smaller than balance', () => {
    rootStore.openTradeStore.setInput('100')
    expect(rootStore.openTradeStore.insufficientBalance).toBe(false)
  })

  describe('opening a trade', () => {
    if (!rootStore.tradeStore.selectedPosition) return

    const mock: any = (): jest.Mock<void> => jest.fn()
    const spyExactInput = jest
      .spyOn(rootStore.uniswapRouterStore, 'exactInput')
      .mockImplementation(mock)
    const spyPool = jest
      .spyOn(rootStore.tradeStore.selectedPosition.pool, 'pool', 'get')
      .mockReturnValue(poolMock)

    it('should have the right amount when opening a trade', () => {
      const openTradeParameters = spyExactInput.mock.calls[0][0][0]
      expect(openTradeParameters.amountIn).toStrictEqual(parseEther(`${amountToTrade}`))
    })

    it('should call UniswapRouter exactInput when opening a trade', () => {
      rootStore.openTradeStore.transactionBundle.execute()
      expect(rootStore.uniswapRouterStore.exactInput).toHaveBeenCalledTimes(1)
    })

    spyPool.mockRestore()
    spyExactInput.mockRestore()
  })

  // eslint-disable-next-line jest/no-disabled-tests
  describe.skip('closing a trade', () => {
    if (!rootStore.tradeStore.selectedPosition) return

    const mock: any = (): jest.Mock<void> => jest.fn()
    const spyExactOutput = jest
      .spyOn(rootStore.uniswapRouterStore, 'exactInput')
      .mockImplementation(mock)

    it('should have the right amount to sell when closing a trade', () => {
      const openTradeParameters = spyExactOutput.mock.calls[0][0][0]
      expect(openTradeParameters.amountIn).toStrictEqual(parseEther(`${amountToTrade}`))
    })

    spyExactOutput.mockRestore()
  })
})
