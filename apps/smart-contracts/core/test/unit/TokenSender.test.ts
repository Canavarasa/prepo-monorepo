import { ethers, network } from 'hardhat'
import chai, { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseUnits } from 'ethers/lib/utils'
import { ZERO_ADDRESS, TOKEN_SENDER_ROLES } from 'prepo-constants'
import { utils, snapshots, getRolesAccountDoesNotHave } from 'prepo-hardhat'
import { BigNumber, BigNumberish } from 'ethers'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { tokenSenderFixture } from '../fixtures/TokenSenderFixture'
import { smockTestERC20Fixture } from '../fixtures/TestERC20Fixture'
import { fakeTestUintValueFixture } from '../fixtures/UintValueFixtures'
import { fakeAccountListFixture } from '../fixtures/HookFixture'
import { AccountList, TestERC20, TestUintValue, TokenSender } from '../../types/generated'

chai.use(smock.matchers)

const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)
const { grantAndAcceptRole } = utils

describe('=> TokenSender', () => {
  let tokenSender: TokenSender
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let outputToken: FakeContract<TestERC20>
  let priceOracle: FakeContract<TestUintValue>
  let allowlist: FakeContract<AccountList>
  const OUTPUT_TOKEN_DECIMALS = 18
  const OUTPUT_TOKEN_UNIT = parseUnits('1', OUTPUT_TOKEN_DECIMALS)
  const TEST_PERIOD = 86400
  const TEST_LIMIT = OUTPUT_TOKEN_UNIT
  snapshotter.setupSnapshotContext('TokenSender')
  before(async () => {
    ;[deployer, user] = await ethers.getSigners()
    outputToken = await smockTestERC20Fixture('Output Token', 'OUT', OUTPUT_TOKEN_DECIMALS)
    tokenSender = await tokenSenderFixture(outputToken.address, OUTPUT_TOKEN_DECIMALS)
    priceOracle = await fakeTestUintValueFixture()
    allowlist = await fakeAccountListFixture()
    snapshotter.saveSnapshot()
  })

  describe('# initialize', () => {
    it('sets output token from constructor', async () => {
      expect(await tokenSender.getOutputToken()).eq(outputToken.address)
    })

    it("doesn't set price oracle", async () => {
      expect(await tokenSender.getPriceOracle()).eq(ZERO_ADDRESS)
    })

    it("doesn't set price lower bound", async () => {
      expect(await tokenSender.getPriceLowerBound()).eq(0)
    })

    it('sets role constants', async () => {
      expect(await tokenSender.SET_PRICE_ORACLE_ROLE()).eq(id('setPriceOracle'))
      expect(await tokenSender.SET_PRICE_LOWER_BOUND_ROLE()).eq(id('setPriceLowerBound'))
      expect(await tokenSender.SET_ALLOWED_MSG_SENDERS_ROLE()).eq(id('setAllowedMsgSenders'))
      expect(await tokenSender.SET_ACCOUNT_LIMIT_RESET_PERIOD_ROLE()).eq(
        id('setAccountLimitResetPeriod')
      )
      expect(await tokenSender.SET_ACCOUNT_LIMIT_PER_PERIOD_ROLE()).eq(
        id('setAccountLimitPerPeriod')
      )
      expect(await tokenSender.WITHDRAW_ERC20_ROLE()).eq(id('withdrawERC20'))
    })

    it('assigns all roles to deployer', async () => {
      const rolesDeployerDoesNotHave = await getRolesAccountDoesNotHave(
        tokenSender,
        deployer.address,
        TOKEN_SENDER_ROLES
      )

      expect(rolesDeployerDoesNotHave.length).eq(0)
    })
  })

  describe('# setPriceOracle', () => {
    it('reverts if not role holder', async () => {
      expect(await tokenSender.hasRole(await tokenSender.SET_PRICE_ORACLE_ROLE(), user.address)).eq(
        false
      )

      await expect(tokenSender.connect(user).setPriceOracle(user.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.SET_PRICE_ORACLE_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      await tokenSender.setPriceOracle(user.address)

      expect(await tokenSender.getPriceOracle()).eq(user.address)
    })

    it('sets to zero address', async () => {
      await tokenSender.setPriceOracle(ZERO_ADDRESS)

      expect(await tokenSender.getPriceOracle()).eq(ZERO_ADDRESS)
    })

    it('is idempotent for non-zero address', async () => {
      await tokenSender.setPriceOracle(user.address)
      expect(await tokenSender.getPriceOracle()).eq(user.address)

      await tokenSender.setPriceOracle(user.address)

      expect(await tokenSender.getPriceOracle()).eq(user.address)
    })

    it('is idempotent for zero address', async () => {
      await tokenSender.setPriceOracle(ZERO_ADDRESS)
      expect(await tokenSender.getPriceOracle()).eq(ZERO_ADDRESS)

      await tokenSender.setPriceOracle(ZERO_ADDRESS)

      expect(await tokenSender.getPriceOracle()).eq(ZERO_ADDRESS)
    })

    it('emits PriceOracleChange', async () => {
      await expect(tokenSender.setPriceOracle(user.address))
        .to.emit(tokenSender, 'PriceOracleChange')
        .withArgs(user.address)
    })
  })

  describe('# setPriceLowerBound', () => {
    it('reverts if not role holder', async () => {
      expect(
        await tokenSender.hasRole(await tokenSender.SET_PRICE_LOWER_BOUND_ROLE(), user.address)
      ).eq(false)

      await expect(tokenSender.connect(user).setPriceLowerBound(0)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.SET_PRICE_LOWER_BOUND_ROLE()}`
      )
    })

    it('sets to zero', async () => {
      await tokenSender.setPriceLowerBound(0)

      expect(await tokenSender.getPriceLowerBound()).eq(0)
    })

    it('sets to non-zero', async () => {
      await tokenSender.setPriceLowerBound(1)

      expect(await tokenSender.getPriceLowerBound()).eq(1)
    })

    it('is idempotent for zero', async () => {
      await tokenSender.setPriceLowerBound(0)
      expect(await tokenSender.getPriceLowerBound()).eq(0)

      await tokenSender.setPriceLowerBound(0)

      expect(await tokenSender.getPriceLowerBound()).eq(0)
    })

    it('is idempotent for non-zero', async () => {
      await tokenSender.setPriceLowerBound(1)
      expect(await tokenSender.getPriceLowerBound()).eq(1)

      await tokenSender.setPriceLowerBound(1)

      expect(await tokenSender.getPriceLowerBound()).eq(1)
    })

    it('emits PriceLowerBoundChange', async () => {
      await expect(tokenSender.setPriceLowerBound(1))
        .to.emit(tokenSender, 'PriceLowerBoundChange')
        .withArgs(1)
    })
  })

  describe('# setAllowedMsgSenders', () => {
    it('reverts if not role holder', async () => {
      expect(
        await tokenSender.hasRole(await tokenSender.SET_ALLOWED_MSG_SENDERS_ROLE(), user.address)
      ).eq(false)

      await expect(tokenSender.connect(user).setAllowedMsgSenders(ZERO_ADDRESS)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.SET_ALLOWED_MSG_SENDERS_ROLE()}`
      )
    })
  })

  describe('# setAccountLimitResetPeriod', () => {
    it('reverts if not role holder', async () => {
      expect(
        await tokenSender.hasRole(
          await tokenSender.SET_ACCOUNT_LIMIT_RESET_PERIOD_ROLE(),
          user.address
        )
      ).eq(false)

      await expect(tokenSender.connect(user).setAccountLimitResetPeriod(0)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.SET_ACCOUNT_LIMIT_RESET_PERIOD_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await tokenSender.hasRole(
          await tokenSender.SET_ACCOUNT_LIMIT_RESET_PERIOD_ROLE(),
          deployer.address
        )
      ).eq(true)

      await tokenSender.connect(deployer).setAccountLimitResetPeriod(0)
    })
  })

  describe('# setAccountLimitPerPeriod', () => {
    beforeEach(async () => {
      await grantAndAcceptRole(
        tokenSender,
        deployer,
        deployer,
        await tokenSender.SET_ACCOUNT_LIMIT_PER_PERIOD_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await tokenSender.hasRole(
          await tokenSender.SET_ACCOUNT_LIMIT_PER_PERIOD_ROLE(),
          user.address
        )
      ).eq(false)

      await expect(tokenSender.connect(user).setAccountLimitPerPeriod(0)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.SET_ACCOUNT_LIMIT_PER_PERIOD_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await tokenSender.hasRole(
          await tokenSender.SET_ACCOUNT_LIMIT_PER_PERIOD_ROLE(),
          deployer.address
        )
      ).eq(true)

      await tokenSender.connect(deployer).setAccountLimitPerPeriod(0)
    })
  })

  describe('# withdrawERC20', () => {
    it('reverts if not role holder', async () => {
      expect(await tokenSender.hasRole(await tokenSender.WITHDRAW_ERC20_ROLE(), user.address)).eq(
        false
      )

      await expect(tokenSender.connect(user)['withdrawERC20(address[])']([])).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.WITHDRAW_ERC20_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await tokenSender.hasRole(await tokenSender.WITHDRAW_ERC20_ROLE(), deployer.address)
      ).eq(true)

      await tokenSender.connect(deployer)['withdrawERC20(address[])']([])
    })
  })

  describe('# send', () => {
    snapshotter.setupSnapshotContext('TokenSender-send')
    before(async () => {
      await tokenSender.connect(deployer).setPriceOracle(priceOracle.address)
      await tokenSender.connect(deployer).setAllowedMsgSenders(allowlist.address)
      await tokenSender.connect(deployer).setPriceLowerBound(1)
      await tokenSender.connect(deployer).setAccountLimitResetPeriod(TEST_PERIOD)
      await tokenSender.connect(deployer).setAccountLimitPerPeriod(TEST_LIMIT)
      snapshotter.saveSnapshot()
    })

    beforeEach(() => {
      allowlist.isIncluded.returns(true)
    })

    async function calculateExpectedOutput(unconvertedAmount: BigNumberish): Promise<BigNumber> {
      const price = await priceOracle.get()
      expect(price).gt(await tokenSender.getPriceLowerBound())
      const outputAmount = ethers.BigNumber.from(unconvertedAmount)
        .mul(OUTPUT_TOKEN_UNIT)
        .div(price)
      return outputAmount
    }

    it('reverts if not allowed caller', async () => {
      allowlist.isIncluded.returns(false)
      expect(await allowlist.isIncluded(user.address)).eq(false)

      await expect(tokenSender.connect(user).send(user.address, 1)).revertedWithCustomError(
        tokenSender,
        'MsgSenderNotAllowed'
      )
    })

    it("doesn't transfer if unconverted amount = 0", async () => {
      priceOracle.get.returns(2)

      await tokenSender.connect(deployer).send(user.address, 0)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if price = 0", async () => {
      priceOracle.get.returns(0)

      await tokenSender.connect(deployer).send(user.address, 1)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if price < lowerBound", async () => {
      priceOracle.get.returns(1)
      await tokenSender.connect(deployer).setPriceLowerBound(2)

      await tokenSender.connect(deployer).send(user.address, 1)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if price = lowerBound", async () => {
      priceOracle.get.returns(1)
      expect(await tokenSender.getPriceLowerBound()).eq(1)

      await tokenSender.connect(deployer).send(user.address, 1)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if outputAmount > token balance", async () => {
      priceOracle.get.returns(2)
      const outputAmount = await calculateExpectedOutput(10)
      expect(outputAmount).gt(0)
      expect(outputAmount).gt(await outputToken.balanceOf(tokenSender.address))

      await tokenSender.connect(deployer).send(user.address, 1)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if outputAmount = 0", async () => {
      // If unconverted amount is 1 wei and price is > 1 ether, output amount will be 0
      priceOracle.get.returns(OUTPUT_TOKEN_UNIT.add(1))
      const unconvertedAmount = 1
      const outputAmount = await calculateExpectedOutput(unconvertedAmount)
      expect(outputAmount).eq(0)

      await tokenSender.connect(deployer).send(user.address, unconvertedAmount)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if amount > account limit and caller != recipient", async () => {
      priceOracle.get.returns(OUTPUT_TOKEN_UNIT) // 1 for 1
      const outputAmount = await calculateExpectedOutput(TEST_LIMIT.add(1))
      expect(outputAmount).eq(TEST_LIMIT.add(1))
      await outputToken.connect(deployer).mint(tokenSender.address, TEST_LIMIT.add(1))

      await tokenSender.connect(deployer).send(user.address, TEST_LIMIT.add(1))

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if sent amount > account limit and caller = recipient", async () => {
      priceOracle.get.returns(OUTPUT_TOKEN_UNIT) // 1 for 1
      const outputAmount = await calculateExpectedOutput(TEST_LIMIT.add(1))
      expect(outputAmount).eq(TEST_LIMIT.add(1))
      await outputToken.connect(deployer).mint(tokenSender.address, TEST_LIMIT.add(1))

      await tokenSender.connect(deployer).send(deployer.address, TEST_LIMIT.add(1))

      expect(outputToken.transfer).not.called
    })

    it("adds sent amount to caller's total if = account limit and caller != recipient", async () => {
      priceOracle.get.returns(OUTPUT_TOKEN_UNIT)
      const outputAmount = await calculateExpectedOutput(TEST_LIMIT)
      expect(outputAmount).eq(TEST_LIMIT)
      const callerAmountThisPeriod = await tokenSender.getAmountThisPeriod(deployer.address)
      const recipientAmountThisPeriod = await tokenSender.getAmountThisPeriod(user.address)
      await outputToken.connect(deployer).mint(tokenSender.address, TEST_LIMIT)

      await tokenSender.connect(deployer).send(user.address, TEST_LIMIT)

      expect(await tokenSender.getAmountThisPeriod(deployer.address)).eq(
        callerAmountThisPeriod.add(TEST_LIMIT)
      )
      expect(await tokenSender.getAmountThisPeriod(user.address)).eq(recipientAmountThisPeriod)
    })

    it("adds sent amount to caller's total if < account limit and caller != recipient", async () => {
      priceOracle.get.returns(OUTPUT_TOKEN_UNIT)
      const outputAmount = await calculateExpectedOutput(TEST_LIMIT.sub(1))
      expect(outputAmount).lt(TEST_LIMIT)
      const callerAmountThisPeriod = await tokenSender.getAmountThisPeriod(deployer.address)
      const recipientAmountThisPeriod = await tokenSender.getAmountThisPeriod(user.address)
      await outputToken.connect(deployer).mint(tokenSender.address, TEST_LIMIT.sub(1))

      await tokenSender.connect(deployer).send(user.address, TEST_LIMIT.sub(1))

      expect(await tokenSender.getAmountThisPeriod(deployer.address)).eq(
        callerAmountThisPeriod.add(TEST_LIMIT.sub(1))
      )
      expect(await tokenSender.getAmountThisPeriod(user.address)).eq(recipientAmountThisPeriod)
    })

    it("adds sent amount to caller's total if = account limit and caller = recipient", async () => {
      priceOracle.get.returns(OUTPUT_TOKEN_UNIT)
      const outputAmount = await calculateExpectedOutput(TEST_LIMIT)
      expect(outputAmount).eq(TEST_LIMIT)
      const callerAmountThisPeriod = await tokenSender.getAmountThisPeriod(deployer.address)
      const recipientAmountThisPeriod = await tokenSender.getAmountThisPeriod(user.address)
      await outputToken.connect(deployer).mint(tokenSender.address, TEST_LIMIT)

      await tokenSender.connect(deployer).send(deployer.address, TEST_LIMIT)

      expect(await tokenSender.getAmountThisPeriod(deployer.address)).eq(
        callerAmountThisPeriod.add(TEST_LIMIT)
      )
      expect(await tokenSender.getAmountThisPeriod(user.address)).eq(recipientAmountThisPeriod)
    })

    it("adds sent amount to caller's total if < account limit and caller = recipient", async () => {
      priceOracle.get.returns(OUTPUT_TOKEN_UNIT)
      const outputAmount = await calculateExpectedOutput(TEST_LIMIT.sub(1))
      expect(outputAmount).lt(TEST_LIMIT)
      const callerAmountThisPeriod = await tokenSender.getAmountThisPeriod(deployer.address)
      const recipientAmountThisPeriod = await tokenSender.getAmountThisPeriod(user.address)
      await outputToken.connect(deployer).mint(tokenSender.address, TEST_LIMIT.sub(1))

      await tokenSender.connect(deployer).send(deployer.address, TEST_LIMIT.sub(1))

      expect(await tokenSender.getAmountThisPeriod(deployer.address)).eq(
        callerAmountThisPeriod.add(TEST_LIMIT.sub(1))
      )
      expect(await tokenSender.getAmountThisPeriod(user.address)).eq(recipientAmountThisPeriod)
    })

    it('transfers', async () => {
      priceOracle.get.returns(OUTPUT_TOKEN_UNIT)
      await outputToken.connect(deployer).mint(tokenSender.address, ethers.constants.MaxUint256)
      const unconvertedAmount = 10
      const outputAmount = await calculateExpectedOutput(unconvertedAmount)
      expect(outputAmount).gt(0)
      expect(await outputToken.balanceOf(tokenSender.address)).gt(outputAmount)

      await tokenSender.connect(deployer).send(user.address, unconvertedAmount)

      expect(outputToken.transfer).calledWith(user.address, outputAmount)
      expect(await outputToken.balanceOf(user.address)).eq(outputAmount)
    })
  })
})
