import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { formatBytes32String, parseEther } from 'ethers/lib/utils'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { DEPOSIT_HOOK_ROLES, PERCENT_UNIT, ZERO_ADDRESS } from 'prepo-constants'
import { snapshots, getRolesAccountDoesNotHave } from 'prepo-hardhat'
import { depositHookFixture, fakeAccountListFixture } from '../fixtures/HookFixture'
import { setAccountBalance, testRoleConstants } from '../utils'
import { fakeTokenSenderFixture } from '../fixtures/TokenSenderFixture'
import { smockTestERC20Fixture } from '../fixtures/TestERC20Fixture'
import { fakeCollateralFixture } from '../fixtures/CollateralFixture'
import { fakeDepositRecordFixture } from '../fixtures/DepositRecordFixture'
import {
  AccountList,
  Collateral,
  DepositHook,
  DepositRecord,
  TestERC20,
  TokenSender,
} from '../../types/generated'

chai.use(smock.matchers)

const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> DepositHook', () => {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let recipient: SignerWithAddress
  let treasury: SignerWithAddress
  let depositHook: DepositHook
  let testToken: MockContract<TestERC20>
  let tokenSender: FakeContract<TokenSender>
  let depositRecord: FakeContract<DepositRecord>
  let fakeCollateral: FakeContract<Collateral>
  let bypassList: FakeContract<AccountList>
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_AMOUNT_BEFORE_FEE = parseEther('1.01')
  const TEST_AMOUNT_AFTER_FEE = parseEther('1')
  const TEST_AMOUNT_MULTIPLIER = PERCENT_UNIT * 2
  const JUNK_PAYLOAD = formatBytes32String('JUNK_PAYLOAD')

  snapshotter.setupSnapshotContext('DepositHook')
  before(async () => {
    ;[deployer, user, treasury, recipient] = await ethers.getSigners()
    testToken = await smockTestERC20Fixture('Test Token', 'TEST', 18)
    tokenSender = await fakeTokenSenderFixture()
    depositRecord = await fakeDepositRecordFixture()
    depositHook = await depositHookFixture()
    fakeCollateral = await fakeCollateralFixture()
    bypassList = await fakeAccountListFixture()
    await setAccountBalance(fakeCollateral.address, '0.1')
    fakeCollateral.getBaseToken.returns(testToken.address)
    await snapshotter.saveSnapshot()
  })

  describe('initial state', () => {
    it('sets collateral to zero address', async () => {
      expect(await depositHook.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('sets role constants to the correct hash', async () => {
      await testRoleConstants([
        depositHook.SET_ACCOUNT_LIST_ROLE(),
        'setAccountList',
        depositHook.SET_TREASURY_ROLE(),
        'setTreasury',
        depositHook.SET_TOKEN_SENDER_ROLE(),
        'setTokenSender',
        depositHook.SET_COLLATERAL_ROLE(),
        'setCollateral',
        depositHook.SET_DEPOSIT_RECORD_ROLE(),
        'setDepositRecord',
        depositHook.SET_DEPOSITS_ALLOWED_ROLE(),
        'setDepositsAllowed',
        depositHook.SET_AMOUNT_MULTIPLIER_ROLE(),
        'setAmountMultiplier',
      ])
    })

    it('assigns all roles to deployer', async () => {
      const rolesDeployerDoesNotHave = await getRolesAccountDoesNotHave(
        depositHook,
        deployer.address,
        DEPOSIT_HOOK_ROLES
      )

      expect(rolesDeployerDoesNotHave.length).eq(0)
    })
  })

  describe('# hook', () => {
    /**
     * Tests below use different values for TEST_AMOUNT_BEFORE_FEE and
     * TEST_AMOUNT_AFTER_FEE to ensure TEST_AMOUNT_BEFORE_FEE is ignored.
     */
    snapshotter.setupSnapshotContext('DepositHook-hook')
    before(async () => {
      depositRecord.recordDeposit.returns()
      await depositHook.connect(deployer).setAccountList(bypassList.address)
      await depositHook.connect(deployer).setCollateral(fakeCollateral.address)
      await depositHook.connect(deployer).setDepositsAllowed(true)
      await depositHook.connect(deployer).setDepositRecord(depositRecord.address)
      await depositHook.connect(deployer).setTreasury(treasury.address)
      await depositHook
        .connect(deployer)
        .setAmountMultiplier(fakeCollateral.address, TEST_AMOUNT_MULTIPLIER)
      await depositHook.connect(deployer).setTokenSender(tokenSender.address)
      await testToken.connect(deployer).mint(fakeCollateral.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken.connect(deployer).mint(user.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken
        .connect(fakeCollateral.wallet)
        .approve(depositHook.address, ethers.constants.MaxUint256)
      await snapshotter.saveSnapshot()
    })

    it('should only usable by collateral', async () => {
      expect(await depositHook.getCollateral()).to.not.eq(user.address)

      await expect(
        depositHook
          .connect(user)
          ['hook(address,address,uint256,uint256,bytes)'](
            user.address,
            user.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )
      ).revertedWithCustomError(depositHook, 'MsgSenderNotCollateral')
    })

    it('reverts if deposits not allowed', async () => {
      await depositHook.connect(deployer).setDepositsAllowed(false)
      expect(await depositHook.getDepositsAllowed()).to.eq(false)

      await expect(
        depositHook
          .connect(fakeCollateral.wallet)
          ['hook(address,address,uint256,uint256,bytes)'](
            user.address,
            user.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )
      ).revertedWithCustomError(depositHook, 'DepositsNotAllowed')
    })

    it('calls recordDeposit() if fee = 0', async () => {
      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          user.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_BEFORE_FEE,
          JUNK_PAYLOAD
        )

      expect(depositRecord.recordDeposit).calledWith(user.address, TEST_AMOUNT_BEFORE_FEE)
    })

    it('calls recordDeposit() if fee > 0 and funder = recipient', async () => {
      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          user.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      expect(depositRecord.recordDeposit).calledWith(user.address, TEST_AMOUNT_AFTER_FEE)
    })

    it('calls recordDeposit() if fee > 0 and funder != recipient', async () => {
      expect(user.address).not.eq(recipient.address)

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          recipient.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      expect(depositRecord.recordDeposit).calledWith(recipient.address, TEST_AMOUNT_AFTER_FEE)
    })

    it('calls recordDeposit() without fee subtracted if fee > 0 and recipient in bypass list', async () => {
      bypassList.isIncluded.whenCalledWith(recipient.address).returns(true)

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          recipient.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      expect(depositRecord.recordDeposit).calledWith(recipient.address, TEST_AMOUNT_BEFORE_FEE)
    })

    it('transfers fee to treasury if fee > 0', async () => {
      expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          user.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
      expect(testToken.transferFrom).calledWith(fakeCollateral.address, treasury.address, fee)
    })

    it('calls tokenSender.send() if fee > 0 and funder = recipient', async () => {
      expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          user.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
      expect(tokenSender.send).calledWith(
        user.address,
        fee.mul(TEST_AMOUNT_MULTIPLIER).div(PERCENT_UNIT)
      )
    })

    it('calls tokenSender.send() if fee > 0 and funder != recipient', async () => {
      expect(user.address).not.eq(recipient.address)
      expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          recipient.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
      expect(tokenSender.send).calledWith(
        recipient.address,
        fee.mul(TEST_AMOUNT_MULTIPLIER).div(PERCENT_UNIT)
      )
    })

    it("doesn't transfer fee to treasury if fee = 0", async () => {
      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          user.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_BEFORE_FEE,
          JUNK_PAYLOAD
        )

      expect(testToken.transferFrom).not.called
    })

    it("doesn't transfer fee to treasury if recipient in bypass list", async () => {
      bypassList.isIncluded.whenCalledWith(recipient.address).returns(true)

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          recipient.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      expect(testToken.transferFrom).not.called
    })

    it("doesn't call tokenSender.send() if fee = 0", async () => {
      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          user.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_BEFORE_FEE,
          JUNK_PAYLOAD
        )

      expect(tokenSender.send).not.called
    })

    it("doesn't call tokenSender.send() if multiplier = 0", async () => {
      await depositHook.connect(deployer).setAmountMultiplier(fakeCollateral.address, 0)
      expect(TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)).gt(0)

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          user.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      expect(tokenSender.send).not.called
    })

    it("doesn't call tokenSender.send() if tokenSender not set", async () => {
      expect(TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)).gt(0)
      expect(await depositHook.getAmountMultiplier(fakeCollateral.address)).gt(0)
      await depositHook.connect(deployer).setTokenSender(ZERO_ADDRESS)

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          user.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      expect(tokenSender.send).not.called
    })

    it("doesn't call tokenSender.send() if scaled fee rounds to 0 from multiplier < 1", async () => {
      await depositHook.connect(deployer).setAmountMultiplier(fakeCollateral.address, 1)
      const feeToCauseRoundingToZero = PERCENT_UNIT - 1 // 1 * 999999 / 1000000 = 0

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          user.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_BEFORE_FEE.sub(feeToCauseRoundingToZero),
          JUNK_PAYLOAD
        )

      expect(tokenSender.send).not.called
    })

    it("doesn't call tokenSender.send() if recipient in bypass list", async () => {
      bypassList.isIncluded.whenCalledWith(recipient.address).returns(true)
      expect(TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)).gt(0)
      expect(await depositHook.getTokenSender()).not.eq(ZERO_ADDRESS)
      expect(await depositHook.getAmountMultiplier(fakeCollateral.address)).gt(0)

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          recipient.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      expect(tokenSender.send).not.called
    })

    it("doesn't call bypasslist if bypasslist not set", async () => {
      await depositHook.connect(deployer).setAccountList(ZERO_ADDRESS)

      await depositHook
        .connect(fakeCollateral.wallet)
        ['hook(address,address,uint256,uint256,bytes)'](
          user.address,
          recipient.address,
          TEST_AMOUNT_BEFORE_FEE,
          TEST_AMOUNT_AFTER_FEE,
          JUNK_PAYLOAD
        )

      expect(bypassList.isIncluded).not.called
    })

    afterEach(() => {
      bypassList.isIncluded.reset()
      depositRecord.recordDeposit.reset()
      testToken.transferFrom.reset()
      tokenSender.send.reset()
    })
  })

  describe('# setAccountList', () => {
    it('reverts if not role holder', async () => {
      expect(await depositHook.hasRole(await depositHook.SET_ACCOUNT_LIST_ROLE(), user.address)).eq(
        false
      )

      await expect(depositHook.connect(user).setAccountList(bypassList.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_ACCOUNT_LIST_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_ACCOUNT_LIST_ROLE(), deployer.address)
      ).eq(true)

      await depositHook.connect(deployer).setAccountList(bypassList.address)
    })
  })

  describe('# setCollateral', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_COLLATERAL_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setCollateral(fakeCollateral.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_COLLATERAL_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_COLLATERAL_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook.connect(deployer).setCollateral(fakeCollateral.address)
    })
  })

  describe('# setDepositRecord', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_DEPOSIT_RECORD_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setDepositRecord(depositRecord.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_DEPOSIT_RECORD_ROLE()}`
      )
    })
  })

  describe('# setDepositsAllowed', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_DEPOSITS_ALLOWED_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setDepositsAllowed(true)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_DEPOSITS_ALLOWED_ROLE()}`
      )
    })

    it('sets to false', async () => {
      await depositHook.connect(deployer).setDepositsAllowed(true)
      expect(await depositHook.getDepositsAllowed()).to.not.eq(false)

      await depositHook.connect(deployer).setDepositsAllowed(false)

      expect(await depositHook.getDepositsAllowed()).to.eq(false)
    })

    it('sets to true', async () => {
      expect(await depositHook.getDepositsAllowed()).to.not.eq(true)

      await depositHook.connect(deployer).setDepositsAllowed(true)

      expect(await depositHook.getDepositsAllowed()).to.eq(true)
    })

    it('is idempotent', async () => {
      expect(await depositHook.getDepositsAllowed()).to.not.eq(true)

      await depositHook.connect(deployer).setDepositsAllowed(true)

      expect(await depositHook.getDepositsAllowed()).to.eq(true)

      await depositHook.connect(deployer).setDepositsAllowed(true)

      expect(await depositHook.getDepositsAllowed()).to.eq(true)
    })

    it('emits DepositsAllowedChange', async () => {
      const tx = await depositHook.connect(deployer).setDepositsAllowed(true)

      await expect(tx).to.emit(depositHook, 'DepositsAllowedChange').withArgs(true)
    })
  })

  describe('# setTreasury', () => {
    it('reverts if not role holder', async () => {
      expect(await depositHook.hasRole(await depositHook.SET_TREASURY_ROLE(), user.address)).to.eq(
        false
      )

      await expect(depositHook.connect(user).setTreasury(treasury.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_TREASURY_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_TREASURY_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook.connect(deployer).setTreasury(treasury.address)
    })
  })

  describe('# setAmountMultiplier', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_AMOUNT_MULTIPLIER_ROLE(), user.address)
      ).to.eq(false)

      await expect(
        depositHook.connect(user).setAmountMultiplier(fakeCollateral.address, 1)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_AMOUNT_MULTIPLIER_ROLE()}`
      )
    })

    it('reverts if setting multiplier for zero address', async () => {
      await expect(
        depositHook.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 1)
      ).revertedWithCustomError(depositHook, 'InvalidAccount')
    })

    it('reverts if setting multiplier not for collateral', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_AMOUNT_MULTIPLIER_ROLE(), deployer.address)
      ).eq(true)
      await depositHook.connect(deployer).setCollateral(fakeCollateral.address)

      await expect(
        depositHook.connect(deployer).setAmountMultiplier(user.address, 1)
      ).revertedWithCustomError(depositHook, 'InvalidAccount')
    })

    it('sets multiplier for collateral', async () => {
      await depositHook.connect(deployer).setCollateral(fakeCollateral.address)
      expect(await depositHook.getAmountMultiplier(fakeCollateral.address)).not.eq(1)

      await depositHook.connect(deployer).setAmountMultiplier(fakeCollateral.address, 1)

      expect(await depositHook.getAmountMultiplier(fakeCollateral.address)).eq(1)
    })
  })

  describe('# setTokenSender', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_TOKEN_SENDER_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setTokenSender(tokenSender.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_TOKEN_SENDER_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_TOKEN_SENDER_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook.connect(deployer).setTokenSender(tokenSender.address)
    })
  })
})
