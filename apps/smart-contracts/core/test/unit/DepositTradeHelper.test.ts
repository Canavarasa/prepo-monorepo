import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { formatBytes32String, parseUnits, parseEther } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { utils, snapshots } from 'prepo-hardhat'
import { ZERO_BYTES32, JUNK_ADDRESS, ZERO_ADDRESS, PERCENT_UNIT } from 'prepo-constants'
import { getPermitFromSignature } from '../utils'
import { fakeVaultFixture } from '../fixtures/BalancerFixtures'
import { depositTradeHelperFixture } from '../fixtures/DepositTradeHelperFixture'
import { fakeSwapRouterFixture } from '../fixtures/UniswapFixtures'
import { MockCoreWithMockBaseToken } from '../../harnesses/mock'
import { DepositTradeHelper, IDepositTradeHelper, IVault, SwapRouter } from '../../types/generated'
import { getBaseTokenAmountForDeposit, getCollateralAmountForDeposit } from '../../helpers'

const { nowPlusMonths } = utils

chai.use(smock.matchers)
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> DepositTradeHelper', () => {
  let core: MockCoreWithMockBaseToken
  let swapRouter: FakeContract<SwapRouter>
  let wstethVault: FakeContract<IVault>
  let depositTradeHelper: DepositTradeHelper
  let deployer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  const TEST_POOL_ID = formatBytes32String('JUNK_DATA')
  const TEST_DEADLINE = nowPlusMonths(1)
  const TEST_TRADE_FEE_PERCENT = 10000 // 1%
  const TEST_REBATE_MULTIPLIER = PERCENT_UNIT * 2 // 2X
  const FAKE_POSITION_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000002'
  const JUNK_PAYLOAD = formatBytes32String('JUNK_PAYLOAD')
  snapshotter.setupSnapshotContext('DepositTradeHelper')

  const junkPermit = <IDepositTradeHelper.PermitStruct>{
    deadline: 0,
    v: 0,
    r: formatBytes32String('JUNK_DATA'),
    s: formatBytes32String('JUNK_DATA'),
  }

  const junkTradeParams = <IDepositTradeHelper.OffChainTradeParamsStruct>{
    positionToken: JUNK_ADDRESS,
    deadline: 0,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  }
  /**
   * `amountOutMinimum` should be 0 since we are relying on fake return values from the
   * Balancer vault. Since no tokens are actually returned by the Balancer swap, the
   * function would revert if amountOutMinimum > 0. This is OK because we are only modifying
   * this to preserve the existing units tests around the now internal `depositAndTrade`
   * function.
   */
  const junkBalancerParams = <IDepositTradeHelper.OffChainBalancerParamsStruct>{
    amountOutMinimum: 0,
    deadline: TEST_DEADLINE,
  }

  before(async () => {
    core = await MockCoreWithMockBaseToken.Instance.init(ethers)
    ;[deployer, user1, user2] = core.accounts
    swapRouter = await fakeSwapRouterFixture()
    wstethVault = await fakeVaultFixture()
    depositTradeHelper = await depositTradeHelperFixture(
      core.collateral.address,
      swapRouter.address,
      wstethVault.address
    )
    await snapshotter.saveSnapshot()
  })

  describe('initial state', () => {
    it('sets collateral from constructor', async () => {
      expect(await depositTradeHelper.getCollateral()).to.eq(core.collateral.address)
    })

    it('sets base token from collateral', async () => {
      expect(await depositTradeHelper.getBaseToken()).to.eq(core.baseToken.address)
    })

    it('sets swap router from constructor', async () => {
      expect(await depositTradeHelper.getSwapRouter()).to.eq(swapRouter.address)
    })

    it('sets WstETH vault from constructor', async () => {
      expect(await depositTradeHelper.getWstethVault()).to.eq(wstethVault.address)
    })

    it('gives collateral contract unlimited base token approval', async () => {
      expect(
        await core.baseToken.allowance(depositTradeHelper.address, core.collateral.address)
      ).to.eq(ethers.constants.MaxUint256)
    })

    it('gives swap router unlimited collateral approval', async () => {
      expect(await core.collateral.allowance(depositTradeHelper.address, swapRouter.address)).to.eq(
        ethers.constants.MaxUint256
      )
    })
  })

  describe('# setWstethPoolId', () => {
    it('reverts if not owner', async () => {
      await expect(depositTradeHelper.connect(user1).setWstethPoolId(TEST_POOL_ID)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero id', async () => {
      expect(await depositTradeHelper.getWstethPoolId()).not.eq(TEST_POOL_ID)

      await depositTradeHelper.connect(deployer).setWstethPoolId(TEST_POOL_ID)

      expect(await depositTradeHelper.getWstethPoolId()).not.eq(ZERO_BYTES32)
      expect(await depositTradeHelper.getWstethPoolId()).eq(TEST_POOL_ID)
    })

    it('sets to zero id', async () => {
      await depositTradeHelper.connect(deployer).setWstethPoolId(TEST_POOL_ID)
      expect(await depositTradeHelper.getWstethPoolId()).not.eq(ZERO_BYTES32)

      await depositTradeHelper.connect(deployer).setWstethPoolId(ZERO_BYTES32)

      expect(await depositTradeHelper.getWstethPoolId()).eq(ZERO_BYTES32)
    })

    it('is idempotent', async () => {
      expect(await depositTradeHelper.getWstethPoolId()).not.eq(TEST_POOL_ID)

      await depositTradeHelper.connect(deployer).setWstethPoolId(TEST_POOL_ID)

      expect(await depositTradeHelper.getWstethPoolId()).eq(TEST_POOL_ID)

      await depositTradeHelper.connect(deployer).setWstethPoolId(TEST_POOL_ID)

      expect(await depositTradeHelper.getWstethPoolId()).eq(TEST_POOL_ID)
    })

    it('emits WstethPoolIdChange event', async () => {
      const tx = await depositTradeHelper.connect(deployer).setWstethPoolId(TEST_POOL_ID)

      await expect(tx).emit(depositTradeHelper, 'WstethPoolIdChange').withArgs(TEST_POOL_ID)
    })
  })

  describe('# setTradeFeePercent', () => {
    it('reverts if not owner', async () => {
      await expect(
        depositTradeHelper.connect(user1).setTradeFeePercent(TEST_TRADE_FEE_PERCENT)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('sets to non-zero fee', async () => {
      expect(TEST_TRADE_FEE_PERCENT).not.eq(0)
      expect(await depositTradeHelper.getTradeFeePercent()).not.eq(TEST_TRADE_FEE_PERCENT)

      await depositTradeHelper.connect(deployer).setTradeFeePercent(TEST_TRADE_FEE_PERCENT)

      expect(await depositTradeHelper.getTradeFeePercent()).not.eq(0)
      expect(await depositTradeHelper.getTradeFeePercent()).eq(TEST_TRADE_FEE_PERCENT)
    })

    it('sets to zero fee', async () => {
      await depositTradeHelper.connect(deployer).setTradeFeePercent(TEST_TRADE_FEE_PERCENT)

      await depositTradeHelper.connect(deployer).setTradeFeePercent(0)

      expect(await depositTradeHelper.getTradeFeePercent()).eq(0)
    })

    it('is idempotent', async () => {
      expect(await depositTradeHelper.getTradeFeePercent()).not.eq(TEST_TRADE_FEE_PERCENT)

      await depositTradeHelper.connect(deployer).setTradeFeePercent(TEST_TRADE_FEE_PERCENT)

      expect(await depositTradeHelper.getTradeFeePercent()).eq(TEST_TRADE_FEE_PERCENT)

      await depositTradeHelper.connect(deployer).setTradeFeePercent(TEST_TRADE_FEE_PERCENT)

      expect(await depositTradeHelper.getTradeFeePercent()).eq(TEST_TRADE_FEE_PERCENT)
    })

    it('emits TradeFeePercentChange event', async () => {
      const tx = await depositTradeHelper
        .connect(deployer)
        .setTradeFeePercent(TEST_TRADE_FEE_PERCENT)

      await expect(tx)
        .emit(depositTradeHelper, 'TradeFeePercentChange')
        .withArgs(TEST_TRADE_FEE_PERCENT)
    })
  })

  describe('# setTokenSender', () => {
    it('reverts if not owner', async () => {
      expect(await depositTradeHelper.owner()).not.eq(user1.address)

      await expect(depositTradeHelper.connect(user1).setTokenSender(user2.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('succeeds if owner', async () => {
      expect(await depositTradeHelper.owner()).eq(deployer.address)

      await depositTradeHelper.connect(deployer).setTokenSender(user2.address)
    })
  })

  describe('# setAmountMultiplier', () => {
    it('reverts if not owner', async () => {
      expect(await depositTradeHelper.owner()).not.eq(user1.address)

      await expect(
        depositTradeHelper.connect(user1).setAmountMultiplier(ZERO_ADDRESS, TEST_REBATE_MULTIPLIER)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if setting multiplier for non-zero address', async () => {
      expect(await depositTradeHelper.owner()).eq(deployer.address)

      await expect(
        depositTradeHelper
          .connect(deployer)
          .setAmountMultiplier(user1.address, TEST_REBATE_MULTIPLIER)
      ).revertedWithCustomError(depositTradeHelper, 'InvalidAccount')
    })

    it('sets multiplier for zero address', async () => {
      expect(await depositTradeHelper.getAmountMultiplier(ZERO_ADDRESS)).not.eq(1)

      await depositTradeHelper.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 1)

      expect(await depositTradeHelper.getAmountMultiplier(ZERO_ADDRESS)).eq(1)
    })
  })

  describe('# setTreasury', () => {
    it('reverts if not owner', async () => {
      expect(await depositTradeHelper.owner()).not.eq(user1.address)

      await expect(depositTradeHelper.connect(user1).setTreasury(user2.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('succeeds if owner', async () => {
      expect(await depositTradeHelper.owner()).eq(deployer.address)

      await depositTradeHelper.connect(deployer).setTreasury(user2.address)
    })
  })

  describe('# wrapAndDepositAndTrade', () => {
    let expectedCollateralBeforeFee: BigNumber
    let expectedCollateralAfterFee: BigNumber
    let expectedCollateralFee: BigNumber
    let permitForFunder: IDepositTradeHelper.PermitStruct
    let permitForRecipient: IDepositTradeHelper.PermitStruct
    const TEST_DEPOSIT_AMOUNT = parseUnits('1', 18)
    snapshotter.setupSnapshotContext('DepositTradeHelper-wrapAndDepositAndTrade')
    before(async () => {
      await core.baseToken.mint(user1.address, TEST_DEPOSIT_AMOUNT)
      expectedCollateralBeforeFee = await getCollateralAmountForDeposit(
        core.collateral,
        TEST_DEPOSIT_AMOUNT
      )
      expectedCollateralFee = expectedCollateralBeforeFee
        .mul(TEST_TRADE_FEE_PERCENT)
        .div(PERCENT_UNIT)
      expectedCollateralAfterFee = expectedCollateralBeforeFee.sub(expectedCollateralFee)
      /**
       * This is a hack since we are not using an actual Balancer vault and wstETH contract.
       * Send base token to the contract ahead of time so that the `wrapAndDeposit` portion
       * has base token to deposit.
       */
      await core.baseToken.connect(user1).transfer(depositTradeHelper.address, TEST_DEPOSIT_AMOUNT)
      permitForFunder = await getPermitFromSignature(
        core.collateral,
        user1,
        depositTradeHelper.address,
        ethers.constants.MaxUint256,
        TEST_DEADLINE
      )
      permitForRecipient = await getPermitFromSignature(
        core.collateral,
        user2,
        depositTradeHelper.address,
        ethers.constants.MaxUint256,
        TEST_DEADLINE
      )
      core.tokenSender.send.returns()
      await depositTradeHelper.connect(deployer).setTokenSender(core.tokenSender.address)
      await depositTradeHelper.connect(deployer).setTreasury(user2.address)
      await depositTradeHelper.connect(deployer).setTradeFeePercent(TEST_TRADE_FEE_PERCENT)
      await depositTradeHelper
        .connect(deployer)
        .setAmountMultiplier(ZERO_ADDRESS, TEST_REBATE_MULTIPLIER)
      await snapshotter.saveSnapshot()
    })

    beforeEach(() => {
      /**
       * Vault needs to return the amount we are depositing since we use
       * the wstETH amount returned by the swap.
       */
      wstethVault.swap.returns(TEST_DEPOSIT_AMOUNT)
      core.tokenSender.send.returns()
      core.collateral.depositHook['hook(address,address,uint256,uint256,bytes)'].returns()
    })

    it('reverts if insufficient collateral approval', async () => {
      await core.collateral
        .connect(user1)
        .approve(depositTradeHelper.address, expectedCollateralBeforeFee.sub(1))

      await expect(
        depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user1.address, JUNK_PAYLOAD, junkBalancerParams, junkPermit, junkTradeParams)
      ).revertedWith('ERC20: insufficient allowance')
    })

    describe('permit testing', () => {
      it('reverts if permit for funder and recipient != funder', async () => {
        await expect(
          depositTradeHelper
            .connect(user1)
            [
              'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
            ](user2.address, JUNK_PAYLOAD, junkBalancerParams, permitForFunder, junkTradeParams)
        ).revertedWith('ERC20Permit: invalid signature')
      })

      it('ignores collateral approval if deadline = 0', async () => {
        await core.collateral
          .connect(user1)
          .approve(depositTradeHelper.address, expectedCollateralBeforeFee)
        expect(junkPermit.deadline).to.eq(0)

        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user1.address, JUNK_PAYLOAD, junkBalancerParams, junkPermit, junkTradeParams)

        expect(core.collateral.permit).not.called
        expect(await core.collateral.allowance(user1.address, depositTradeHelper.address)).to.eq(0)
      })

      it('processes collateral approval permit for funder if recipient = funder', async () => {
        expect(await core.collateral.allowance(user1.address, depositTradeHelper.address)).to.eq(0)
        expect(await core.collateral.allowance(user2.address, depositTradeHelper.address)).to.eq(0)

        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user1.address, JUNK_PAYLOAD, junkBalancerParams, permitForFunder, junkTradeParams)

        expect(core.collateral.permit).called
        expect(await core.collateral.allowance(user1.address, depositTradeHelper.address)).to.eq(
          ethers.constants.MaxUint256
        )
        expect(await core.collateral.allowance(user2.address, depositTradeHelper.address)).to.eq(0)
      })

      it('processes collateral approval permit for funder if recipient != funder', async () => {
        expect(await core.collateral.allowance(user1.address, depositTradeHelper.address)).to.eq(0)
        expect(await core.collateral.allowance(user2.address, depositTradeHelper.address)).to.eq(0)

        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user2.address, JUNK_PAYLOAD, junkBalancerParams, permitForRecipient, junkTradeParams)

        expect(core.collateral.permit).called
        expect(await core.collateral.allowance(user1.address, depositTradeHelper.address)).to.eq(0)
        expect(await core.collateral.allowance(user2.address, depositTradeHelper.address)).to.eq(
          ethers.constants.MaxUint256
        )
      })
    })

    describe('trade testing', () => {
      it('mints Collateral to funder prior to transferring back if recipient = funder', async () => {
        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user1.address, JUNK_PAYLOAD, junkBalancerParams, permitForFunder, junkTradeParams)

        expect(core.collateral.deposit.atCall(0)).calledWith(
          user1.address,
          TEST_DEPOSIT_AMOUNT,
          JUNK_PAYLOAD
        )
        expect(core.collateral.deposit).calledBefore(core.collateral.transferFrom)
      })

      it('mints Collateral to recipient prior to transferring back if recipient != funder', async () => {
        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user2.address, JUNK_PAYLOAD, junkBalancerParams, permitForRecipient, junkTradeParams)

        expect(core.collateral.deposit.atCall(0)).calledWith(
          user2.address,
          TEST_DEPOSIT_AMOUNT,
          JUNK_PAYLOAD
        )
        expect(core.collateral.deposit).calledBefore(core.collateral.transferFrom)
      })

      it('takes newly minted Collateral from funder if recipient = funder', async () => {
        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user1.address, JUNK_PAYLOAD, junkBalancerParams, permitForFunder, junkTradeParams)

        expect(core.collateral.transferFrom.atCall(0)).calledWith(
          user1.address,
          depositTradeHelper.address,
          expectedCollateralBeforeFee
        )
        expect(core.collateral.transferFrom).calledBefore(swapRouter.exactInputSingle)
      })

      it('takes newly minted Collateral from recipient if recipient != funder', async () => {
        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user2.address, JUNK_PAYLOAD, junkBalancerParams, permitForRecipient, junkTradeParams)

        expect(core.collateral.transferFrom.atCall(0)).calledWith(
          user2.address,
          depositTradeHelper.address,
          expectedCollateralBeforeFee
        )
        expect(core.collateral.transferFrom).calledBefore(swapRouter.exactInputSingle)
      })

      it("doesn't call token sender if not set", async () => {
        await depositTradeHelper.connect(deployer).setTokenSender(ZERO_ADDRESS)
        expect(await depositTradeHelper.getTradeFeePercent()).gt(0)

        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user2.address, JUNK_PAYLOAD, junkBalancerParams, permitForRecipient, junkTradeParams)

        expect(core.tokenSender.send).not.called
      })

      it("doesn't call token sender if fee percent = 0", async () => {
        expect(await depositTradeHelper.getTokenSender()).not.eq(ZERO_ADDRESS)
        await depositTradeHelper.connect(deployer).setTradeFeePercent(0)

        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user2.address, JUNK_PAYLOAD, junkBalancerParams, permitForRecipient, junkTradeParams)

        expect(core.tokenSender.send).not.called
      })

      it("doesn't call token sender if multiplier = 0", async () => {
        expect(await depositTradeHelper.getTokenSender()).not.eq(ZERO_ADDRESS)
        expect(await depositTradeHelper.getTradeFeePercent()).gt(0)
        await depositTradeHelper.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 0)

        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user2.address, JUNK_PAYLOAD, junkBalancerParams, permitForRecipient, junkTradeParams)

        expect(core.tokenSender.send).not.called
      })

      it("doesn't call token sender if scaled fee rounds to 0 from multiplier < 1", async () => {
        expect(await depositTradeHelper.getTokenSender()).not.eq(ZERO_ADDRESS)
        expect(await depositTradeHelper.getTradeFeePercent()).gt(0)
        await depositTradeHelper.setAmountMultiplier(ZERO_ADDRESS, 1)
        /**
         * Collateral amount * helper fee (known) / fee unit * multiplier (known) / multiplier unit = 0
         * In integer division, this means collateral amount * helper fee / fee unit must equal 999999 (multiplier unit - 1)
         */
        const collateralForScaledFeeRoundToZero = BigNumber.from(PERCENT_UNIT - 1)
          .mul(PERCENT_UNIT)
          .div(TEST_TRADE_FEE_PERCENT)
        /**
         * As stated in previous testcases, we cannot mock the weth behavior of directly sending raw ETH and
         * swapping for raw wstETH, thus as a hack, we send beforehand, the wstETH necessary to cover Collateral
         * minting. Since this amount deviates from all other tests, we need to ensure the contract only has
         * what we need for this testcase.
         *
         * First, we wipe the contract of previously sent base token by calling wrapAndDepositAndTrade
         */
        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user2.address, JUNK_PAYLOAD, junkBalancerParams, permitForRecipient, junkTradeParams)
        const baseTokenNeededForScaledFeeRoundToZero = await getBaseTokenAmountForDeposit(
          core.collateral,
          collateralForScaledFeeRoundToZero
        )
        await core.baseToken
          .connect(deployer)
          .mint(depositTradeHelper.address, baseTokenNeededForScaledFeeRoundToZero)
        // Change amount we fool contract into thinking was returned by swap to deposit
        wstethVault.swap.returns(baseTokenNeededForScaledFeeRoundToZero)
        core.tokenSender.send.reset()
        core.tokenSender.send.returns()

        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user2.address, JUNK_PAYLOAD, junkBalancerParams, junkPermit, junkTradeParams)

        expect(core.tokenSender.send).not.called
      })

      it('calls token sender if scaled fee > 0', async () => {
        expect(await depositTradeHelper.getTokenSender()).not.eq(ZERO_ADDRESS)
        expect(await depositTradeHelper.getTradeFeePercent()).gt(0)
        expect(await depositTradeHelper.getAmountMultiplier(ZERO_ADDRESS)).gt(0)
        expect(expectedCollateralFee.mul(TEST_REBATE_MULTIPLIER).div(PERCENT_UNIT)).gt(0)

        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user2.address, JUNK_PAYLOAD, junkBalancerParams, permitForRecipient, junkTradeParams)

        expect(core.tokenSender.send).calledWith(
          user2.address,
          expectedCollateralFee.mul(TEST_REBATE_MULTIPLIER).div(PERCENT_UNIT)
        )
      })

      it('calls swap router with correct parameters', async () => {
        const nonZeroTradeParams = <IDepositTradeHelper.OffChainTradeParamsStruct>{
          positionToken: FAKE_POSITION_TOKEN_ADDRESS,
          deadline: TEST_DEADLINE,
          amountOutMinimum: parseEther('1'),
          sqrtPriceLimitX96: parseEther('2'),
        }

        await depositTradeHelper
          .connect(user1)
          [
            'wrapAndDepositAndTrade(address,bytes,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))'
          ](user2.address, JUNK_PAYLOAD, junkBalancerParams, permitForRecipient, nonZeroTradeParams)

        const swapRouterCallArgs = swapRouter.exactInputSingle
          .atCall(0)
          .callHistory[0].args[0].slice(0, 8)
        const correctSwapArgs = [
          core.collateral.address,
          FAKE_POSITION_TOKEN_ADDRESS,
          await depositTradeHelper.POOL_FEE_TIER(),
          user2.address,
          TEST_DEADLINE,
          expectedCollateralAfterFee,
          parseEther('1'),
          parseEther('2'),
        ]
        swapRouterCallArgs.forEach((arg, i) => {
          expect(arg).to.eq(correctSwapArgs[i])
        })
      })
    })

    afterEach(() => {
      wstethVault.swap.reset()
      core.collateral.depositHook['hook(address,address,uint256,uint256,bytes)'].reset()
      core.collateral.deposit.reset()
      core.collateral.transferFrom.reset()
      core.collateral.permit.reset()
      core.tokenSender.send.reset()
      swapRouter.exactInputSingle.reset()
    })
  })
})
