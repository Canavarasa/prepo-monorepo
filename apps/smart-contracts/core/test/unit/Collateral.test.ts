/* eslint-disable func-names */
import chai, { expect } from 'chai'
import { ethers, network, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { formatBytes32String, id, parseEther, parseUnits } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import {
  COLLATERAL_FEE_LIMIT,
  COLLATERAL_ROLES,
  DEFAULT_ADMIN_ROLE,
  PERCENT_UNIT,
  ZERO_ADDRESS,
} from 'prepo-constants'
import { getRolesAccountDoesNotHave, utils } from 'prepo-hardhat'
import {
  fakeDepositHookFixture,
  fakeWithdrawHookFixture,
  smockDepositHookFixture,
  smockWithdrawHookFixture,
} from '../fixtures/HookFixture'
import { collateralFixture } from '../fixtures/CollateralFixture'
import { fakeDepositRecordFixture } from '../fixtures/DepositRecordFixture'
import { smockTestERC20Fixture } from '../fixtures/TestERC20Fixture'
import { fakeTokenSenderFixture } from '../fixtures/TokenSenderFixture'
import { roleAssigners } from '../../helpers'
import {
  Collateral,
  DepositHook,
  DepositRecord,
  TestERC20,
  TokenSender,
  WithdrawHook,
} from '../../types/generated'

chai.use(smock.matchers)

const { grantAndAcceptRole, generateDomainSeparator } = utils

describe('=> Collateral', () => {
  let deployer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let governance: SignerWithAddress
  let baseToken: MockContract<TestERC20>
  let collateral: Collateral
  let depositHook: MockContract<DepositHook>
  let withdrawHook: MockContract<WithdrawHook>
  let tokenSender: FakeContract<TokenSender>
  let fakeDepositRecord: FakeContract<DepositRecord>
  let snapshotBeforeAllTests: string
  let snapshotBeforeEachTest: string
  const TEST_NAME = 'prePO wstETH Collateral'
  const TEST_SYMBOL = 'preWstETH'
  const TEST_DEPOSIT_FEE_PERCENT = 1000 // 0.1%
  const TEST_WITHDRAW_FEE_PERCENT = 2000 // 0.2%
  const USDC_DECIMALS = 6
  const USDC_DENOMINATOR = 10 ** USDC_DECIMALS
  const JUNK_PAYLOAD = formatBytes32String('JUNK_PAYLOAD')

  const getSignersAndDeployContracts = async (
    baseTokenDecimals: number = USDC_DECIMALS
  ): Promise<void> => {
    ;[deployer, user1, user2, governance] = await ethers.getSigners()
    baseToken = await smockTestERC20Fixture('Test Coin', 'TST', baseTokenDecimals)
    collateral = await collateralFixture(
      TEST_NAME,
      TEST_SYMBOL,
      baseToken.address,
      baseTokenDecimals
    )
    depositHook = await smockDepositHookFixture()
    withdrawHook = await smockWithdrawHookFixture(baseTokenDecimals)
    tokenSender = await fakeTokenSenderFixture()
    fakeDepositRecord = await fakeDepositRecordFixture()
  }

  const setupDepositHook = async (): Promise<void> => {
    await roleAssigners.assignDepositHookRoles(deployer, governance, depositHook)
    await depositHook.connect(governance).setCollateral(collateral.address)
    await depositHook.connect(governance).setDepositsAllowed(true)
    await depositHook.connect(governance).setDepositRecord(fakeDepositRecord.address)
    await depositHook.connect(governance).setTreasury(governance.address)
    await depositHook.connect(governance).setTokenSender(tokenSender.address)
  }

  const setupWithdrawHook = async (): Promise<void> => {
    await roleAssigners.assignWithdrawHookRoles(deployer, governance, withdrawHook)
    await withdrawHook.connect(governance).setCollateral(collateral.address)
    await withdrawHook.connect(governance).setDepositRecord(fakeDepositRecord.address)
    await withdrawHook.connect(governance).setTreasury(governance.address)
    await withdrawHook.connect(governance).setTokenSender(tokenSender.address)
  }

  const setupCollateralRoles = async (): Promise<void> => {
    await roleAssigners.assignCollateralRoles(deployer, governance, collateral)
  }

  const setupCollateralStackForDeposits = async (
    baseTokenDecimals: number = USDC_DECIMALS
  ): Promise<void> => {
    await getSignersAndDeployContracts(baseTokenDecimals)
    await setupCollateralRoles()
    await setupDepositHook()
  }

  const setupCollateralStackForWithdrawals = async (
    baseTokenDecimals: number = USDC_DECIMALS
  ): Promise<void> => {
    await setupCollateralStackForDeposits(baseTokenDecimals)
    await setupWithdrawHook()
  }

  before(async () => {
    upgrades.silenceWarnings()
    snapshotBeforeAllTests = await ethers.provider.send('evm_snapshot', [])
  })

  describe('initial state', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it('sets base token from constructor', async () => {
      expect(await collateral.getBaseToken()).to.eq(baseToken.address)
    })

    it('sets name from initialize', async () => {
      expect(await collateral.name()).to.eq(TEST_NAME)
    })

    it('sets symbol from initialize', async () => {
      expect(await collateral.symbol()).to.eq(TEST_SYMBOL)
    })

    it('sets DEFAULT_ADMIN_ROLE holder to deployer', async () => {
      expect(await collateral.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.eq(true)
    })

    it('sets PERCENT_UNIT constant', async () => {
      expect(await collateral.PERCENT_UNIT()).to.eq(PERCENT_UNIT)
    })

    it('sets FEE_LIMIT constant', async () => {
      expect(await collateral.FEE_LIMIT()).to.eq(COLLATERAL_FEE_LIMIT)
    })

    it('sets role constants to the correct hash', async () => {
      expect(await collateral.SET_DEPOSIT_FEE_PERCENT_ROLE()).to.eq(id('setDepositFeePercent'))
      expect(await collateral.SET_WITHDRAW_FEE_PERCENT_ROLE()).to.eq(id('setWithdrawFeePercent'))
      expect(await collateral.SET_DEPOSIT_HOOK_ROLE()).to.eq(id('setDepositHook'))
      expect(await collateral.SET_WITHDRAW_HOOK_ROLE()).to.eq(id('setWithdrawHook'))
    })

    it('generates domain separator from token name', async () => {
      /**
       * Domain separator is generated using the chainId accessed via
       * `block.chainid`. It seems that the hardhat test network will return
       * 0 for the chainId when accessed in-contract via `block.chainid`, even
       * though the network provider designates 31337 for hardhat networks.
       */
      expect(await collateral.DOMAIN_SEPARATOR()).to.eq(
        generateDomainSeparator(TEST_NAME, '1', 31337, collateral.address)
      )
    })

    it('assigns all roles to deployer', async () => {
      const rolesDeployerDoesNotHave = await getRolesAccountDoesNotHave(
        collateral,
        deployer.address,
        COLLATERAL_ROLES
      )

      expect(rolesDeployerDoesNotHave.length).eq(0)
    })
  })

  describe('# setDepositFeePercent', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      await grantAndAcceptRole(
        collateral,
        deployer,
        governance,
        await collateral.SET_DEPOSIT_FEE_PERCENT_ROLE()
      )
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_DEPOSIT_FEE_PERCENT_ROLE(), user1.address)
      ).to.eq(false)

      await expect(
        collateral.connect(user1).setDepositFeePercent(TEST_DEPOSIT_FEE_PERCENT)
      ).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.SET_DEPOSIT_FEE_PERCENT_ROLE()}`
      )
    })

    it('reverts if > FEE_LIMIT', async () => {
      await expect(
        collateral.connect(governance).setDepositFeePercent(COLLATERAL_FEE_LIMIT + 1)
      ).revertedWith('Exceeds fee limit')
    })

    it('sets to FEE_LIMIT', async () => {
      expect(await collateral.getDepositFeePercent()).to.not.eq(COLLATERAL_FEE_LIMIT)

      await collateral.connect(governance).setDepositFeePercent(COLLATERAL_FEE_LIMIT)

      expect(await collateral.getDepositFeePercent()).to.eq(COLLATERAL_FEE_LIMIT)
    })

    it('sets to < FEE_LIMIT', async () => {
      expect(await collateral.getDepositFeePercent()).to.not.eq(COLLATERAL_FEE_LIMIT - 1)

      await collateral.connect(governance).setDepositFeePercent(COLLATERAL_FEE_LIMIT - 1)

      expect(await collateral.getDepositFeePercent()).to.eq(COLLATERAL_FEE_LIMIT - 1)
    })

    it('sets to zero', async () => {
      await collateral.connect(governance).setDepositFeePercent(TEST_DEPOSIT_FEE_PERCENT)
      expect(await collateral.getDepositFeePercent()).to.not.eq(0)

      await collateral.connect(governance).setDepositFeePercent(0)

      expect(await collateral.getDepositFeePercent()).to.eq(0)
    })

    it('is idempotent', async () => {
      expect(await collateral.getDepositFeePercent()).to.not.eq(TEST_DEPOSIT_FEE_PERCENT)

      await collateral.connect(governance).setDepositFeePercent(TEST_DEPOSIT_FEE_PERCENT)

      expect(await collateral.getDepositFeePercent()).to.eq(TEST_DEPOSIT_FEE_PERCENT)

      await collateral.connect(governance).setDepositFeePercent(TEST_DEPOSIT_FEE_PERCENT)

      expect(await collateral.getDepositFeePercent()).to.eq(TEST_DEPOSIT_FEE_PERCENT)
    })

    it('emits DepositFeePercentChange', async () => {
      const tx = await collateral.connect(governance).setDepositFeePercent(TEST_DEPOSIT_FEE_PERCENT)

      await expect(tx)
        .to.emit(collateral, 'DepositFeePercentChange')
        .withArgs(TEST_DEPOSIT_FEE_PERCENT)
    })
  })

  describe('# setWithdrawFeePercent', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      await grantAndAcceptRole(
        collateral,
        deployer,
        governance,
        await collateral.SET_WITHDRAW_FEE_PERCENT_ROLE()
      )
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_WITHDRAW_FEE_PERCENT_ROLE(), user1.address)
      ).to.eq(false)

      await expect(
        collateral.connect(user1).setWithdrawFeePercent(TEST_WITHDRAW_FEE_PERCENT)
      ).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.SET_WITHDRAW_FEE_PERCENT_ROLE()}`
      )
    })

    it('reverts if > FEE_LIMIT', async () => {
      await expect(
        collateral.connect(governance).setWithdrawFeePercent(COLLATERAL_FEE_LIMIT + 1)
      ).revertedWith('Exceeds fee limit')
    })

    it('sets to FEE_LIMIT', async () => {
      expect(await collateral.getWithdrawFeePercent()).to.not.eq(COLLATERAL_FEE_LIMIT)

      await collateral.connect(governance).setWithdrawFeePercent(COLLATERAL_FEE_LIMIT)

      expect(await collateral.getWithdrawFeePercent()).to.eq(COLLATERAL_FEE_LIMIT)
    })

    it('sets to < FEE_LIMIT', async () => {
      expect(await collateral.getWithdrawFeePercent()).to.not.eq(COLLATERAL_FEE_LIMIT - 1)

      await collateral.connect(governance).setWithdrawFeePercent(COLLATERAL_FEE_LIMIT - 1)

      expect(await collateral.getWithdrawFeePercent()).to.eq(COLLATERAL_FEE_LIMIT - 1)
    })

    it('sets to zero', async () => {
      await collateral.connect(governance).setWithdrawFeePercent(TEST_WITHDRAW_FEE_PERCENT)
      expect(await collateral.getWithdrawFeePercent()).to.not.eq(0)

      await collateral.connect(governance).setWithdrawFeePercent(0)

      expect(await collateral.getWithdrawFeePercent()).to.eq(0)
    })

    it('is idempotent', async () => {
      expect(await collateral.getWithdrawFeePercent()).to.not.eq(TEST_WITHDRAW_FEE_PERCENT)

      await collateral.connect(governance).setWithdrawFeePercent(TEST_WITHDRAW_FEE_PERCENT)

      expect(await collateral.getWithdrawFeePercent()).to.eq(TEST_WITHDRAW_FEE_PERCENT)

      await collateral.connect(governance).setWithdrawFeePercent(TEST_WITHDRAW_FEE_PERCENT)

      expect(await collateral.getWithdrawFeePercent()).to.eq(TEST_WITHDRAW_FEE_PERCENT)
    })

    it('emits WithdrawFeePercentChange', async () => {
      const tx = await collateral
        .connect(governance)
        .setWithdrawFeePercent(TEST_WITHDRAW_FEE_PERCENT)

      await expect(tx)
        .to.emit(collateral, 'WithdrawFeePercentChange')
        .withArgs(TEST_WITHDRAW_FEE_PERCENT)
    })
  })

  describe('# setDepositHook', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      await grantAndAcceptRole(
        collateral,
        deployer,
        governance,
        await collateral.SET_DEPOSIT_HOOK_ROLE()
      )
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_DEPOSIT_HOOK_ROLE(), user1.address)
      ).to.eq(false)

      await expect(collateral.connect(user1).setDepositHook(user1.address)).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.SET_DEPOSIT_HOOK_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      expect(await collateral.getDepositHook()).to.not.eq(user1.address)

      await collateral.connect(governance).setDepositHook(user1.address)

      expect(await collateral.getDepositHook()).to.eq(user1.address)
    })

    it('sets to zero address', async () => {
      await collateral.connect(governance).setDepositHook(user1.address)
      expect(await collateral.getDepositHook()).to.not.eq(ZERO_ADDRESS)

      await collateral.connect(governance).setDepositHook(ZERO_ADDRESS)

      expect(await collateral.getDepositHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await collateral.getDepositHook()).to.not.eq(user1.address)

      await collateral.connect(governance).setDepositHook(user1.address)

      expect(await collateral.getDepositHook()).to.eq(user1.address)

      await collateral.connect(governance).setDepositHook(user1.address)

      expect(await collateral.getDepositHook()).to.eq(user1.address)
    })

    it('emits DepositHookChange', async () => {
      const tx = await collateral.connect(governance).setDepositHook(user1.address)

      await expect(tx).to.emit(collateral, 'DepositHookChange').withArgs(user1.address)
    })
  })

  describe('# setWithdrawHook', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      await grantAndAcceptRole(
        collateral,
        deployer,
        governance,
        await collateral.SET_WITHDRAW_HOOK_ROLE()
      )
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_WITHDRAW_HOOK_ROLE(), user1.address)
      ).to.eq(false)

      await expect(collateral.connect(user1).setWithdrawHook(user1.address)).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.SET_WITHDRAW_HOOK_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      expect(await collateral.getWithdrawHook()).to.not.eq(user1.address)

      await collateral.connect(governance).setWithdrawHook(user1.address)

      expect(await collateral.getWithdrawHook()).to.eq(user1.address)
    })

    it('sets to zero address', async () => {
      await collateral.connect(governance).setWithdrawHook(user1.address)
      expect(await collateral.getWithdrawHook()).to.not.eq(ZERO_ADDRESS)

      await collateral.connect(governance).setWithdrawHook(ZERO_ADDRESS)

      expect(await collateral.getWithdrawHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await collateral.getWithdrawHook()).to.not.eq(user1.address)

      await collateral.connect(governance).setWithdrawHook(user1.address)

      expect(await collateral.getWithdrawHook()).to.eq(user1.address)

      await collateral.connect(governance).setWithdrawHook(user1.address)

      expect(await collateral.getWithdrawHook()).to.eq(user1.address)
    })

    it('emits WithdrawHookChange', async () => {
      const tx = await collateral.connect(governance).setWithdrawHook(user1.address)

      await expect(tx).to.emit(collateral, 'WithdrawHookChange').withArgs(user1.address)
    })
  })

  describe('# getBaseTokenBalance', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it("returns contract's base token balance", async () => {
      await baseToken.connect(deployer).mint(collateral.address, parseEther('1'))
      const contractBalance = await baseToken.balanceOf(collateral.address)
      expect(contractBalance).to.be.eq(parseEther('1'))

      expect(await collateral.getBaseTokenBalance()).to.eq(contractBalance)
    })
  })

  describe('# deposit', () => {
    let amountToDeposit: BigNumber
    let expectedBTFee: BigNumber
    before(async function () {
      await setupCollateralStackForDeposits()
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    beforeEach(async function () {
      if (this.currentTest?.title.includes('= base token decimals')) {
        await setupCollateralStackForDeposits(18)
      } else if (this.currentTest?.title.includes('< base token decimals')) {
        await setupCollateralStackForDeposits(19)
      } else if (this.currentTest?.title.includes('mints to funder if funder = recipient')) {
        /**
         * We have to reset the stack here and take a new snapshot, because now the global
         * contract variables have been overwritten by the special base token setups above.
         * If we do not update the snapshot, the contracts we setup to return back to 6 decimals
         * will be interacting with a network where they never existed.
         */
        await setupCollateralStackForDeposits()
        snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
      }
      amountToDeposit = parseUnits('1.2345', await baseToken.decimals())
      await baseToken.mint(user1.address, amountToDeposit)
      // This is to prevent normal transfers from emitting Approval events
      await baseToken.connect(user1).approve(collateral.address, ethers.constants.MaxUint256)
      await collateral.connect(governance).setDepositFeePercent(TEST_DEPOSIT_FEE_PERCENT)
      await collateral.connect(governance).setDepositHook(depositHook.address)
      expectedBTFee = amountToDeposit.mul(TEST_DEPOSIT_FEE_PERCENT).div(PERCENT_UNIT)
    })

    it('reverts if deposit = 0 and deposit fee = 0%', async () => {
      await collateral.connect(governance).setDepositFeePercent(0)

      await expect(collateral.connect(user1).deposit(user2.address, 0, JUNK_PAYLOAD)).revertedWith(
        'base token amount = 0'
      )
    })

    it('reverts if deposit = 0 and deposit fee > 0%', async () => {
      expect(await collateral.getDepositFeePercent()).to.be.gt(0)

      await expect(collateral.connect(user1).deposit(user2.address, 0, JUNK_PAYLOAD)).revertedWith(
        'fee = 0'
      )
    })

    it('reverts if deposit > 0, fee = 0, and deposit fee > 0%', async () => {
      expect(await collateral.getDepositFeePercent()).to.be.gt(0)
      amountToDeposit = BigNumber.from(1)
      // expect fee to be zero
      expect(amountToDeposit.mul(await collateral.getDepositFeePercent()).div(PERCENT_UNIT)).to.eq(
        0
      )

      await expect(
        collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)
      ).revertedWith('fee = 0')
    })

    it('reverts if insufficient approval', async () => {
      await baseToken.connect(user1).approve(collateral.address, amountToDeposit.sub(1))
      expect(await baseToken.allowance(user1.address, collateral.address)).to.be.lt(amountToDeposit)

      await expect(
        collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)
      ).revertedWith('ERC20: insufficient allowance')
    })

    it('reverts if insufficient balance', async () => {
      amountToDeposit = (await baseToken.balanceOf(user1.address)).add(1)
      expect(await baseToken.allowance(user1.address, collateral.address)).gte(amountToDeposit)

      await expect(
        collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)
      ).revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('reverts if hook reverts', async () => {
      // Instantiate fake hook here because reverts with full mocks does not work for some reason
      const fakeDepositHook = await fakeDepositHookFixture()
      await collateral.connect(governance).setDepositHook(fakeDepositHook.address)
      fakeDepositHook['hook(address,address,uint256,uint256,bytes)'].reverts()

      await expect(collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD))
        .reverted
    })

    it('transfers amount from funder to contract', async () => {
      const user1BTBefore = await baseToken.balanceOf(user1.address)
      expect(amountToDeposit).gt(0)

      const tx = await collateral
        .connect(user1)
        .deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      expect(await baseToken.balanceOf(user1.address)).eq(user1BTBefore.sub(amountToDeposit))
      await expect(tx)
        .to.emit(baseToken, 'Transfer')
        .withArgs(user1.address, collateral.address, amountToDeposit)
    })

    it('approves fee for hook to use', async () => {
      expect(await baseToken.allowance(collateral.address, depositHook.address)).eq(0)

      const tx = await collateral
        .connect(user1)
        .deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, depositHook.address, expectedBTFee)
    })

    it('sets hook approval back to 0', async () => {
      expect(await baseToken.allowance(collateral.address, depositHook.address)).eq(0)

      const tx = await collateral
        .connect(user1)
        .deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, depositHook.address, expectedBTFee)
      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, depositHook.address, 0)
      expect(await baseToken.allowance(collateral.address, depositHook.address)).to.eq(0)
    })

    it('mints decimal-adjusted amount to recipient if decimals > base token decimals', async () => {
      expect(await collateral.decimals()).to.be.gt(await baseToken.decimals())
      const user2CTBefore = await collateral.balanceOf(user2.address)
      const expectedCT = amountToDeposit
        .sub(expectedBTFee)
        .mul(parseEther('1'))
        .div(USDC_DENOMINATOR)

      await collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      expect(await collateral.balanceOf(user2.address)).to.eq(user2CTBefore.add(expectedCT))
      expect(await collateral.balanceOf(user1.address)).to.eq(0)
    })

    it('mints decimal-adjusted amount to recipient if decimals = base token decimals', async () => {
      // Setup 18 decimal base token
      expect(await collateral.decimals()).to.eq(await baseToken.decimals())
      const user2CTBefore = await collateral.balanceOf(user2.address)
      const expectedCT = amountToDeposit.sub(expectedBTFee)

      await collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      expect(await collateral.balanceOf(user2.address)).eq(user2CTBefore.add(expectedCT))
      expect(await collateral.balanceOf(user1.address)).eq(0)
    })

    it('mints decimal-adjusted amount to recipient if decimals < base token decimals', async () => {
      // Setup 19 decimal base token
      expect(await collateral.decimals()).lt(await baseToken.decimals())
      const user2CTBefore = await collateral.balanceOf(user2.address)
      const GREATER_DECIMAL_DENOMINATOR = parseUnits('1', (await collateral.decimals()) + 1)
      const expectedCT = amountToDeposit
        .sub(expectedBTFee)
        .mul(parseEther('1'))
        .div(GREATER_DECIMAL_DENOMINATOR)

      await collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      expect(await collateral.balanceOf(user2.address)).eq(user2CTBefore.add(expectedCT))
      expect(await collateral.balanceOf(user1.address)).eq(0)
    })

    it('mints to funder if funder = recipient', async () => {
      const user1CTBefore = await collateral.balanceOf(user1.address)
      const expectedCT = amountToDeposit
        .sub(expectedBTFee)
        .mul(parseEther('1'))
        .div(USDC_DENOMINATOR)

      await collateral.connect(user1).deposit(user1.address, amountToDeposit, JUNK_PAYLOAD)

      expect(await collateral.balanceOf(user1.address)).eq(user1CTBefore.add(expectedCT))
    })

    it('allows a deposit > 0 if deposit fee = 0%', async () => {
      await collateral.connect(governance).setDepositFeePercent(0)
      const user1BTBefore = await baseToken.balanceOf(user1.address)
      const contractBTBefore = await baseToken.balanceOf(collateral.address)
      const user2CTBefore = await collateral.balanceOf(user2.address)
      const expectedCT = amountToDeposit.mul(parseEther('1')).div(USDC_DENOMINATOR)

      await collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      expect(await baseToken.balanceOf(user1.address)).to.eq(user1BTBefore.sub(amountToDeposit))
      expect(await baseToken.balanceOf(collateral.address)).to.eq(
        contractBTBefore.add(amountToDeposit)
      )
      expect(await baseToken.allowance(collateral.address, depositHook.address)).to.eq(0)
      expect(await collateral.balanceOf(user2.address)).to.eq(user2CTBefore.add(expectedCT))
    })

    it('ignores hook if hook not set', async () => {
      await collateral.connect(governance).setDepositHook(ZERO_ADDRESS)

      await collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      expect(depositHook['hook(address,address,uint256,uint256,bytes)']).callCount(0)
    })

    it("doesn't give fee approval if hook not set", async () => {
      expect(await baseToken.allowance(collateral.address, depositHook.address)).eq(0)
      await collateral.connect(governance).setDepositHook(ZERO_ADDRESS)

      const tx = await collateral
        .connect(user1)
        .deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      await expect(tx).not.emit(baseToken, 'Approval')
    })

    it("doesn't give fee approval if fee percent = 0", async () => {
      await collateral.connect(governance).setDepositFeePercent(0)
      expect(await collateral.getDepositHook()).not.eq(ZERO_ADDRESS)

      const tx = await collateral
        .connect(user1)
        .deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      await expect(tx).not.emit(baseToken, 'Approval')
    })

    it('calls deposit hook with correct parameters', async () => {
      await collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      expect(depositHook['hook(address,address,uint256,uint256,bytes)']).calledWith(
        user1.address,
        user2.address,
        amountToDeposit,
        amountToDeposit.sub(expectedBTFee),
        JUNK_PAYLOAD
      )
    })

    it('calls deposit hook if hook set but fee percent = 0', async () => {
      await collateral.connect(governance).setDepositFeePercent(0)

      await collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      expect(depositHook['hook(address,address,uint256,uint256,bytes)']).calledWith(
        user1.address,
        user2.address,
        amountToDeposit,
        amountToDeposit,
        JUNK_PAYLOAD
      )
    })

    it('mints using amount with partial fee subtracted if hook takes partial fee', async () => {
      const factory = await ethers.getContractFactory('TestCollateralHook')
      // Initialize to take 50% of fee
      const partialFeeDepositHook = await factory
        .connect(governance)
        .deploy(governance.address, PERCENT_UNIT / 2)
      await collateral.connect(governance).setDepositHook(partialFeeDepositHook.address)
      const user1CTBefore = await collateral.balanceOf(user1.address)
      const user2CTBefore = await collateral.balanceOf(user2.address)
      const governanceBTBefore = await baseToken.balanceOf(governance.address)
      const expectedPartialBTFee = expectedBTFee.div(2)
      const expectedCT = amountToDeposit
        .sub(expectedPartialBTFee)
        .mul(parseEther('1'))
        .div(USDC_DENOMINATOR)

      await collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      expect(await collateral.balanceOf(user1.address)).eq(user1CTBefore)
      expect(await collateral.balanceOf(user2.address)).eq(user2CTBefore.add(expectedCT))
      expect(await baseToken.balanceOf(governance.address)).eq(
        governanceBTBefore.add(expectedPartialBTFee)
      )
    })

    it('mints using amount without fee subtracted if hook takes no fee', async () => {
      const factory = await ethers.getContractFactory('TestCollateralHook')
      // Initialize to take 0% of fee
      const partialFeeDepositHook = await factory.connect(governance).deploy(governance.address, 0)
      await collateral.connect(governance).setDepositHook(partialFeeDepositHook.address)
      const user1CTBefore = await collateral.balanceOf(user1.address)
      const user2CTBefore = await collateral.balanceOf(user2.address)
      const governanceBTBefore = await baseToken.balanceOf(governance.address)
      const expectedCT = amountToDeposit.mul(parseEther('1')).div(USDC_DENOMINATOR)

      await collateral.connect(user1).deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      expect(await collateral.balanceOf(user1.address)).eq(user1CTBefore)
      expect(await collateral.balanceOf(user2.address)).eq(user2CTBefore.add(expectedCT))
      expect(await baseToken.balanceOf(governance.address)).eq(governanceBTBefore)
    })

    it('emits Deposit', async () => {
      const tx = await collateral
        .connect(user1)
        .deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)

      await expect(tx)
        .to.emit(collateral, 'Deposit')
        .withArgs(user1.address, user2.address, amountToDeposit.sub(expectedBTFee), expectedBTFee)
    })

    it('returns collateral minted', async () => {
      const expectedCT = amountToDeposit
        .sub(expectedBTFee)
        .mul(parseEther('1'))
        .div(USDC_DENOMINATOR)
      expect(expectedCT).gt(0)

      expect(
        await collateral
          .connect(user1)
          .callStatic.deposit(user2.address, amountToDeposit, JUNK_PAYLOAD)
      ).to.eq(expectedCT)
    })

    afterEach(() => {
      depositHook['hook(address,address,uint256,uint256,bytes)'].reset()
    })
  })

  describe('# withdraw', () => {
    let amountToDeposit: BigNumber
    let amountToWithdraw: BigNumber
    let expectedBTBeforeFee: BigNumber
    let expectedBTToReceive: BigNumber
    let expectedBTFee: BigNumber
    before(async function () {
      await setupCollateralStackForWithdrawals()
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    beforeEach(async function () {
      if (this.currentTest?.title.includes('= base token decimals')) {
        await setupCollateralStackForWithdrawals(18)
      } else if (this.currentTest?.title.includes('< base token decimals')) {
        await setupCollateralStackForWithdrawals(19)
      } else if (this.currentTest?.title.includes('sets hook approval back to 0')) {
        await setupCollateralStackForWithdrawals()
        snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
      }
      amountToDeposit = parseUnits('1.2345', await baseToken.decimals())
      await baseToken.mint(user1.address, amountToDeposit)
      // This is to prevent normal transfers from emitting Approval events
      await baseToken.connect(user1).approve(collateral.address, ethers.constants.MaxUint256)
      await collateral.connect(user1).deposit(user1.address, amountToDeposit, JUNK_PAYLOAD)
      amountToWithdraw = await collateral.balanceOf(user1.address)
      expectedBTBeforeFee = amountToWithdraw
        .mul(parseUnits('1', await baseToken.decimals()))
        .div(parseEther('1'))
      expectedBTFee = expectedBTBeforeFee.mul(TEST_WITHDRAW_FEE_PERCENT).div(PERCENT_UNIT)
      expectedBTToReceive = expectedBTBeforeFee.sub(expectedBTFee)
      await collateral.connect(governance).setWithdrawFeePercent(TEST_WITHDRAW_FEE_PERCENT)
      await collateral.connect(governance).setWithdrawHook(withdrawHook.address)
    })

    it('reverts if withdrawal = 0 and withdraw fee = 0%', async () => {
      await collateral.connect(governance).setWithdrawFeePercent(0)

      await expect(collateral.connect(user1).withdraw(user1.address, 0, JUNK_PAYLOAD)).revertedWith(
        'base token amount = 0'
      )
    })

    it('reverts if withdrawal = 0 and withdraw fee > 0%', async () => {
      expect(await collateral.getWithdrawFeePercent()).to.be.gt(0)

      await expect(collateral.connect(user1).withdraw(user1.address, 0, JUNK_PAYLOAD)).revertedWith(
        'fee = 0'
      )
    })

    it('reverts if withdrawal > 0, fee = 0, and withdraw fee > 0%', async () => {
      /**
       * Given USDC precision is 6, and Collateral is 18, 1e12 will result in 0.000001 USDC
       * (the smallest amount) before fees, resulting in a fee of 0.
       */
      amountToWithdraw = parseUnits('1', 12)
      expectedBTBeforeFee = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      expectedBTFee = expectedBTBeforeFee
        .mul(await collateral.getWithdrawFeePercent())
        .div(PERCENT_UNIT)
      expect(expectedBTFee).eq(0)
      expect(await collateral.getWithdrawFeePercent()).gt(0)

      await expect(
        collateral.connect(user1).withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)
      ).revertedWith('fee = 0')
    })

    it('reverts if base token returned is 0 and withdraw fee = 0%', async () => {
      await collateral.connect(governance).setWithdrawFeePercent(0)
      // Given USDC precision is 6, and Collateral is 18, anything below 1e12 will result in 0
      amountToWithdraw = parseUnits('1', 12).sub(1)
      expectedBTBeforeFee = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      expect(expectedBTBeforeFee).eq(0)

      await expect(
        collateral.connect(user1).withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)
      ).revertedWith('base token amount = 0')
    })

    it('reverts if insufficient balance', async () => {
      amountToWithdraw = (await collateral.balanceOf(user1.address)).add(1)

      await expect(
        collateral.connect(user1).withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)
      ).revertedWith('ERC20: burn amount exceeds balance')
    })

    it('reverts if hook reverts', async () => {
      // Instantiate fake hook here because reverts with full mocks does not work for some reason
      const fakeWithdrawHook = await fakeWithdrawHookFixture()
      await collateral.connect(governance).setWithdrawHook(fakeWithdrawHook.address)
      fakeWithdrawHook['hook(address,address,uint256,uint256,bytes)'].reverts()

      await expect(
        collateral.connect(user1).withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)
      ).reverted
      expect(fakeWithdrawHook['hook(address,address,uint256,uint256,bytes)']).callCount(1)
    })

    it("burns caller's collateral without approval", async () => {
      const totalSupplyBefore = await collateral.totalSupply()
      expect(totalSupplyBefore).gt(0)
      const user1CTBefore = await collateral.balanceOf(user1.address)
      expect(await collateral.allowance(user1.address, collateral.address)).eq(0)

      const tx = await collateral
        .connect(user1)
        .withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      expect(await collateral.totalSupply()).eq(totalSupplyBefore.sub(amountToWithdraw))
      expect(await collateral.balanceOf(user1.address)).eq(user1CTBefore.sub(amountToWithdraw))
      await expect(tx)
        .to.emit(collateral, 'Transfer')
        .withArgs(user1.address, ZERO_ADDRESS, amountToWithdraw)
    })

    it('approves fee to hook adjusting for when decimals > base token decimals', async () => {
      expect(await collateral.decimals()).gt(await baseToken.decimals())
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).to.be.eq(0)

      const tx = await collateral
        .connect(user1)
        .withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, withdrawHook.address, expectedBTFee)
    })

    it('withdraws to recipient adjusting for when decimals > base token decimals', async () => {
      expect(await collateral.decimals()).gt(await baseToken.decimals())
      const user1BTBefore = await baseToken.balanceOf(user1.address)

      await collateral.connect(user1).withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      expect(await baseToken.balanceOf(user1.address)).eq(user1BTBefore.add(expectedBTToReceive))
    })

    it('approves fee to hook adjusting for when decimals = base token decimals', async () => {
      // Setup 18 decimal base token
      expect(await collateral.decimals()).eq(await baseToken.decimals())
      expectedBTBeforeFee = amountToWithdraw
      expectedBTFee = expectedBTBeforeFee
        .mul(await collateral.getWithdrawFeePercent())
        .div(PERCENT_UNIT)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).eq(0)

      const tx = await collateral
        .connect(user1)
        .withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      await expect(tx)
        .emit(baseToken, 'Approval')
        .withArgs(collateral.address, withdrawHook.address, expectedBTFee)
    })

    it('withdraws to recipient adjusting for when decimals = base token decimals', async () => {
      // Setup 18 decimal base token
      expect(await collateral.decimals()).eq(await baseToken.decimals())
      const user1BTBefore = await baseToken.balanceOf(user1.address)
      expectedBTBeforeFee = amountToWithdraw
      expectedBTFee = expectedBTBeforeFee
        .mul(await collateral.getWithdrawFeePercent())
        .div(PERCENT_UNIT)
      expectedBTToReceive = expectedBTBeforeFee.sub(expectedBTFee)

      await collateral.connect(user1).withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      expect(await baseToken.balanceOf(user1.address)).eq(user1BTBefore.add(expectedBTToReceive))
    })

    it('approves fee to hook adjusting for when decimals < base token decimals', async () => {
      // Setup 19 decimal base token
      expect(await collateral.decimals()).lt(await baseToken.decimals())
      const GREATER_DECIMAL_DENOMINATOR = parseUnits('1', (await collateral.decimals()) + 1)
      expectedBTBeforeFee = amountToWithdraw.mul(GREATER_DECIMAL_DENOMINATOR).div(parseEther('1'))
      expectedBTFee = expectedBTBeforeFee
        .mul(await collateral.getWithdrawFeePercent())
        .div(PERCENT_UNIT)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).to.be.eq(0)

      const tx = await collateral
        .connect(user1)
        .withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, withdrawHook.address, expectedBTFee)
    })

    it('withdraws to recipient adjusting for when decimals < base token decimals', async () => {
      // Setup 19 decimal base token
      expect(await collateral.decimals()).lt(await baseToken.decimals())
      const user1BTBefore = await baseToken.balanceOf(user1.address)
      const GREATER_DECIMAL_DENOMINATOR = parseUnits('1', (await collateral.decimals()) + 1)
      expectedBTBeforeFee = amountToWithdraw.mul(GREATER_DECIMAL_DENOMINATOR).div(parseEther('1'))
      expectedBTFee = expectedBTBeforeFee
        .mul(await collateral.getWithdrawFeePercent())
        .div(PERCENT_UNIT)
      expectedBTToReceive = expectedBTBeforeFee.sub(expectedBTFee)

      await collateral.connect(user1).withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      expect(await baseToken.balanceOf(user1.address)).eq(user1BTBefore.add(expectedBTToReceive))
    })

    it('sets hook approval back to 0', async () => {
      const tx = await collateral
        .connect(user1)
        .withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, withdrawHook.address, expectedBTFee)
      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, withdrawHook.address, 0)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).eq(0)
    })

    it('allows withdrawals if withdraw fee = 0%', async () => {
      await collateral.connect(governance).setWithdrawFeePercent(0)
      const user1BTBefore = await baseToken.balanceOf(user1.address)
      const contractBTBefore = await baseToken.balanceOf(collateral.address)
      const user1CTBefore = await collateral.balanceOf(user1.address)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).eq(0)

      await collateral.connect(user1).withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      expect(await baseToken.balanceOf(user1.address)).eq(user1BTBefore.add(expectedBTBeforeFee))
      expect(await baseToken.balanceOf(collateral.address)).eq(
        contractBTBefore.sub(expectedBTBeforeFee)
      )
      expect(await collateral.balanceOf(user1.address)).eq(user1CTBefore.sub(amountToWithdraw))
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).eq(0)
    })

    it('withdraws to recipient if funder != recipient', async () => {
      const user1BTBefore = await baseToken.balanceOf(user1.address)
      const user2BTBefore = await baseToken.balanceOf(user2.address)

      const tx = await collateral
        .connect(user1)
        .withdraw(user2.address, amountToWithdraw, JUNK_PAYLOAD)

      await expect(tx)
        .to.emit(collateral, 'Withdraw')
        .withArgs(user1.address, user2.address, expectedBTToReceive, expectedBTFee)
      expect(user1BTBefore).to.eq(await baseToken.balanceOf(user1.address))
      expect(await baseToken.balanceOf(user2.address)).to.eq(user2BTBefore.add(expectedBTToReceive))
    })

    it('ignores hook if hook not set', async () => {
      await collateral.connect(governance).setWithdrawHook(ZERO_ADDRESS)

      await collateral.connect(user1).withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      expect(withdrawHook['hook(address,address,uint256,uint256,bytes)']).callCount(0)
    })

    it("doesn't give fee approval if hook not set", async () => {
      await collateral.connect(governance).setWithdrawHook(ZERO_ADDRESS)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).eq(0)

      const tx = await collateral
        .connect(user1)
        .withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      await expect(tx).to.not.emit(baseToken, 'Approval')
    })

    it("doesn't give fee approval if fee percent = 0", async () => {
      await collateral.connect(governance).setWithdrawFeePercent(0)
      expect(await collateral.getWithdrawHook()).not.eq(ZERO_ADDRESS)

      const tx = await collateral
        .connect(user1)
        .withdraw(user2.address, amountToWithdraw, JUNK_PAYLOAD)

      await expect(tx).not.emit(baseToken, 'Approval')
    })

    it('calls withdraw hook with correct parameters', async () => {
      await collateral.connect(user1).withdraw(user2.address, amountToWithdraw, JUNK_PAYLOAD)

      expect(withdrawHook['hook(address,address,uint256,uint256,bytes)']).calledWith(
        user1.address,
        user2.address,
        expectedBTBeforeFee,
        expectedBTToReceive,
        JUNK_PAYLOAD
      )
    })

    it('calls withdraw hook if hook set but fee percent = 0', async () => {
      await collateral.connect(governance).setWithdrawFeePercent(0)

      await collateral.connect(user1).withdraw(user2.address, amountToWithdraw, JUNK_PAYLOAD)

      expect(withdrawHook['hook(address,address,uint256,uint256,bytes)']).calledWith(
        user1.address,
        user2.address,
        expectedBTBeforeFee,
        expectedBTBeforeFee,
        JUNK_PAYLOAD
      )
    })

    it('returns amount with partial fee subtracted if hook takes partial fee', async () => {
      const factory = await ethers.getContractFactory('TestCollateralHook')
      // Initialize to take 50% of fee
      const partialFeeWithdrawHook = await factory
        .connect(governance)
        .deploy(governance.address, PERCENT_UNIT / 2)
      await collateral.connect(governance).setWithdrawHook(partialFeeWithdrawHook.address)
      const expectedPartialBTFee = expectedBTFee.div(2)
      expectedBTToReceive = expectedBTBeforeFee.sub(expectedPartialBTFee)

      await collateral.connect(user1).withdraw(user2.address, amountToWithdraw, JUNK_PAYLOAD)

      expect(await baseToken.balanceOf(user2.address)).eq(expectedBTToReceive)
    })

    it('returns using amount without fee subtracted if hook takes no fee', async () => {
      const factory = await ethers.getContractFactory('TestCollateralHook')
      // Initialize to take 0% of fee
      const partialFeeWithdrawHook = await factory.connect(governance).deploy(governance.address, 0)
      await collateral.connect(governance).setWithdrawHook(partialFeeWithdrawHook.address)

      await collateral.connect(user1).withdraw(user2.address, amountToWithdraw, JUNK_PAYLOAD)

      expect(await baseToken.balanceOf(user2.address)).eq(expectedBTBeforeFee)
    })

    it('emits Withdraw', async () => {
      const tx = await collateral
        .connect(user1)
        .withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)

      await expect(tx)
        .to.emit(collateral, 'Withdraw')
        .withArgs(user1.address, user1.address, expectedBTToReceive, expectedBTFee)
    })

    it('returns base token transferred to user', async () => {
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).eq(0)

      expect(
        await collateral
          .connect(user1)
          .callStatic.withdraw(user1.address, amountToWithdraw, JUNK_PAYLOAD)
      ).eq(expectedBTToReceive)
    })

    afterEach(() => {
      withdrawHook['hook(address,address,uint256,uint256,bytes)'].reset()
    })
  })

  afterEach(async () => {
    // revert state of chain to after stacks have been initialized.
    await network.provider.send('evm_revert', [snapshotBeforeEachTest])
    // we need to store snapshot into a new id because you cannot use ids more than once with evm_revert.
    snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
  })

  after(async () => {
    // revert state of chain to before the test ran.
    await network.provider.send('evm_revert', [snapshotBeforeAllTests])
    // we need to store snapshot into a new id because you cannot use ids more than once with evm_revert.
    snapshotBeforeAllTests = await ethers.provider.send('evm_snapshot', [])
  })
})
