/* eslint-disable @typescript-eslint/no-explicit-any */
import { utils } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { configure } from 'mobx'
import { ERC20_UNITS } from '../../../lib/constants'

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global
const amountToDeposit = '1000.0'
const ETH_BALANCE = 2000

describe('DepositStore tests', () => {
  let spyGetBalance: jest.SpyInstance
  let spyDepositsAllowed: jest.SpyInstance
  let spyDepositInitialLoading: jest.SpyInstance

  beforeAll(() => {
    const ethBalanceBN = parseEther(`${ETH_BALANCE}`)
    const { address } = rootStore.web3Store.signerState

    spyGetBalance = jest.spyOn(rootStore.web3Store, 'signerState', 'get').mockReturnValue({
      address,
      balance: ethBalanceBN,
      isContract: false,
    })

    spyDepositsAllowed = jest
      .spyOn(rootStore.collateralStore.depositHook, 'depositsAllowed', 'get')
      .mockReturnValue(true)

    spyDepositInitialLoading = jest
      .spyOn(rootStore.depositStore, 'depositButtonInitialLoading', 'get')
      .mockReturnValue(false)
  })

  afterAll(() => {
    spyGetBalance.mockRestore()
    spyDepositsAllowed.mockRestore()
    spyDepositInitialLoading.mockRestore()
  })

  it('should set the amount', () => {
    rootStore.depositStore.setDepositAmount(amountToDeposit)
    expect(rootStore.depositStore.depositAmount).toBe(amountToDeposit)
  })

  it('should disable button if amount is larger than balance', () => {
    const spyConnected = jest.spyOn(rootStore.web3Store, 'connected', 'get').mockReturnValue(true)
    rootStore.depositStore.setDepositAmount('10000')
    expect(rootStore.depositStore.depositDisabled).toBe(true)
    spyConnected.mockRestore()
  })

  it('should not disable button if amount is smaller than balance', () => {
    rootStore.depositStore.setDepositAmount('100')
    expect(rootStore.depositStore.depositDisabled).toBe(false)
  })

  describe('deposit', () => {
    const mock: any = (): jest.Mock<void> => jest.fn()
    let spyDepositAndWrap: jest.SpyInstance
    let spyAddress: jest.SpyInstance

    beforeEach(() => {
      rootStore.depositStore.setDepositAmount(amountToDeposit)
      spyDepositAndWrap = jest.spyOn(rootStore.depositTradeHelperStore, 'wrapAndDeposit')
      spyAddress = jest
        .spyOn(rootStore.web3Store, 'address', 'get')
        .mockReturnValue('0xdummyAddress')

      spyDepositAndWrap.mockImplementation(mock)
      rootStore.depositStore.deposit()
    })

    afterEach(() => {
      spyAddress.mockRestore()
      spyDepositAndWrap.mockRestore()
    })

    it('should match same amount to deposit to the one sent to the collateral contract', () => {
      const depositParameters = spyDepositAndWrap.mock.calls[0][1]
      expect(utils.formatUnits(depositParameters, ERC20_UNITS)).toBe(amountToDeposit)
    })
  })
})
