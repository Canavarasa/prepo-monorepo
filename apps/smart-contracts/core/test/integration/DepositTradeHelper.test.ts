import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber } from 'ethers'
import { formatBytes32String } from 'ethers/lib/utils'
import { getPrePOAddressForNetwork, ZERO_ADDRESS, SwapKind, PERCENT_UNIT } from 'prepo-constants'
import { utils, snapshots } from 'prepo-hardhat'
import { parseEther } from '@ethersproject/units'
import { create2DeployerFixture } from '../fixtures/Create2DeployerFixtures'
import { MockCoreWithLiveBaseToken } from '../../harnesses/mock'
import { roleAssigners } from '../../helpers/roles'
import {
  attachNonfungiblePositionManager,
  attachSwapRouter,
  attachUniV3Factory,
  mintLiquidityForLongShort,
  getAmountOutForExactInputSingle,
  attachQuoter,
  getAmountInForExactOutputSingle,
} from '../../helpers/uniswap'
import { StandaloneCreateMarketParams } from '../../types'
import {
  Create2Deployer,
  ERC20,
  SwapRouter,
  DepositTradeHelper,
  IDepositTradeHelper,
  IVault,
  UniswapV3Factory,
  NonfungiblePositionManager,
  Quoter,
  UniswapV3OracleUintValue,
} from '../../types/generated'
import { attachVaultFixture, fakeVaultFixture } from '../fixtures/BalancerFixtures'
import { depositTradeHelperFixture } from '../fixtures/DepositTradeHelperFixture'
import { ERC20AttachFixture } from '../fixtures/ERC20Fixture'
import { smockAccountListFixture } from '../fixtures/HookFixture'
import { fakeUniswapV3OracleUintValueFixture } from '../fixtures/UintValueFixtures'
import {
  getBaseTokenAmountForDeposit,
  getBaseTokenAmountForWithdrawal,
  getCollateralAmountForDeposit,
} from '../../helpers'
import { getPermitFromSignature } from '../utils'

const { nowPlusMonths } = utils

chai.use(smock.matchers)
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> DepositTradeHelper', () => {
  let weth: ERC20
  let wsteth: ERC20
  let quoter: Quoter
  let core: MockCoreWithLiveBaseToken
  let deployer: SignerWithAddress
  let governance: SignerWithAddress
  let user: SignerWithAddress
  let defaultMarketParams: StandaloneCreateMarketParams
  let create2Deployer: Create2Deployer
  let swapRouter: SwapRouter
  let wstethVault: IVault
  let depositTradeHelper: DepositTradeHelper
  let fakePrice: FakeContract<UniswapV3OracleUintValue>
  const TEST_NAME_SUFFIX = 'Fake Token ($5-10B)'
  const TEST_SYMBOL_SUFFIX = 'FAKE_5-10B'
  const TEST_FLOOR_PAYOUT = parseEther('0.2')
  const TEST_CEILING_PAYOUT = parseEther('0.8')
  const TEST_EXPIRY_PAYOUT = parseEther('0.5')
  const TEST_FLOOR_VAL = 5
  const TEST_CEILING_VAL = 10
  const TEST_EXPIRY = nowPlusMonths(2)
  const TEST_DEPOSIT_AMOUNT = parseEther('1')
  const TEST_DEPOSIT_FEE_PERCENT = 10000 // 1%
  const TEST_WITHDRAW_FEE_PERCENT = 10000 // 1%
  const TEST_TRADE_FEE_PERCENT = 10000 // 1%
  const TEST_REBATE_MULTIPLIER = PERCENT_UNIT * 2 // 2X
  const TEST_ORACLE_PRICE = parseEther('0.00001')
  const WSTETH_ETH_METASTABLE_POOL_ID =
    '0x36bf227d6bac96e2ab1ebb5492ecec69c691943f000200000000000000000316'
  const JUNK_PERMIT = <IDepositTradeHelper.PermitStruct>{
    deadline: 0,
    v: 0,
    r: formatBytes32String('JUNK_DATA'),
    s: formatBytes32String('JUNK_DATA'),
  }
  const JUNK_PAYLOAD = formatBytes32String('JUNK_PAYLOAD')

  const getBalancerSingleSwapQuote = async (
    kind: SwapKind,
    amount: BigNumber,
    tokenIn: string,
    tokenOut: string
  ): Promise<BigNumber> => {
    const swapParams: IVault.BatchSwapStepStruct = {
      poolId: WSTETH_ETH_METASTABLE_POOL_ID,
      assetInIndex: 0,
      assetOutIndex: 1,
      amount,
      userData: [],
    }
    const fundingParams: IVault.FundManagementStruct = {
      sender: deployer.address,
      fromInternalBalance: false,
      recipient: deployer.address,
      toInternalBalance: false,
    }
    const amountDeltas = await wstethVault.callStatic.queryBatchSwap(
      kind,
      [swapParams],
      [tokenIn, tokenOut],
      fundingParams
    )
    return kind === SwapKind.GIVEN_IN ? amountDeltas[1].abs() : amountDeltas[0].abs()
  }

  snapshotter.setupSnapshotContext('DepositTradeHelper')
  before(async () => {
    /**
     * Connect to Alchemy provider since forking off a specific block
     * number is available to free tiers.
     */
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
            blockNumber: 65307000,
          },
        },
      ],
    })
    weth = await ERC20AttachFixture(ethers, getPrePOAddressForNetwork('WETH', 'arbitrumOne'))
    wsteth = await ERC20AttachFixture(ethers, getPrePOAddressForNetwork('WSTETH', 'arbitrumOne'))
    quoter = await attachQuoter(ethers, getPrePOAddressForNetwork('UNIV3_QUOTER', 'arbitrumOne'))
    core = await MockCoreWithLiveBaseToken.Instance.init(ethers, wsteth)
    ;[deployer, governance, user] = core.accounts
    await roleAssigners.assignCollateralRoles(deployer, governance, core.collateral)
    await roleAssigners.assignDepositHookRoles(deployer, governance, core.collateral.depositHook)
    await roleAssigners.assignWithdrawHookRoles(deployer, governance, core.collateral.withdrawHook)
    await roleAssigners.assignDepositRecordRoles(deployer, governance, core.depositRecord)
    await roleAssigners.assignTokenSenderRoles(deployer, governance, core.tokenSender)
    defaultMarketParams = {
      deployer,
      addressBeacon: core.addressBeacon.address,
      uintBeacon: core.uintBeacon.address,
      parameters: {
        collateral: core.collateral.address,
        floorLongPayout: TEST_FLOOR_PAYOUT,
        ceilingLongPayout: TEST_CEILING_PAYOUT,
        expiryLongPayout: TEST_EXPIRY_PAYOUT,
        floorValuation: TEST_FLOOR_VAL,
        ceilingValuation: TEST_CEILING_VAL,
        expiryTime: TEST_EXPIRY,
      },
    }
    await core.collateral.connect(governance).setDepositFeePercent(TEST_DEPOSIT_FEE_PERCENT)
    await core.collateral.connect(governance).setWithdrawFeePercent(TEST_WITHDRAW_FEE_PERCENT)
    await core.collateral.connect(governance).setDepositHook(core.collateral.depositHook.address)
    await core.collateral.depositHook.connect(governance).setDepositsAllowed(true)
    await core.collateral.depositHook.connect(governance).setCollateral(core.collateral.address)
    await core.collateral.depositHook
      .connect(governance)
      .setDepositRecord(core.depositRecord.address)
    await core.collateral.depositHook.connect(governance).setTreasury(governance.address)
    await core.collateral.connect(governance).setWithdrawHook(core.collateral.withdrawHook.address)
    await core.collateral.withdrawHook.connect(governance).setCollateral(core.collateral.address)
    await core.collateral.withdrawHook
      .connect(governance)
      .setDepositRecord(core.depositRecord.address)
    await core.collateral.withdrawHook.connect(governance).setTreasury(governance.address)
    core.depositRecord.allowedMsgSenders = await smockAccountListFixture()
    core.depositRecord.bypasslist = await smockAccountListFixture()
    await core.depositRecord.allowedMsgSenders.set(
      [core.collateral.depositHook.address, core.collateral.withdrawHook.address],
      [true, true]
    )
    await core.depositRecord
      .connect(governance)
      .setAllowedMsgSenders(core.depositRecord.allowedMsgSenders.address)
    await core.depositRecord
      .connect(governance)
      .setAccountList(core.depositRecord.bypasslist.address)
    await core.depositRecord.connect(governance).setGlobalNetDepositCap(parseEther('100000000'))
    await core.depositRecord.connect(governance).setUserDepositCap(parseEther('1000000'))
    /**
     * Deploy market ensuring L/S token addresses are less than
     * the Collateral address.
     */
    create2Deployer = await create2DeployerFixture()
    await core.createAndAddMockMarket(
      TEST_NAME_SUFFIX,
      TEST_SYMBOL_SUFFIX,
      defaultMarketParams,
      create2Deployer
    )
    swapRouter = await attachSwapRouter(
      ethers,
      getPrePOAddressForNetwork('UNIV3_SWAP_ROUTER', 'arbitrumOne')
    )
    wstethVault = await attachVaultFixture(
      ethers,
      getPrePOAddressForNetwork('WSTETH_ETH_BALANCER_VAULT', 'arbitrumOne')
    )
    core.tokenSender.getOutputToken.returns(core.rewardToken.address)
    depositTradeHelper = await depositTradeHelperFixture(
      core.collateral.address,
      swapRouter.address,
      wstethVault.address
    )
    core.tokenSender.allowedMsgSenders = await smockAccountListFixture()
    core.tokenSender.allowedMsgSenders.isIncluded
      .whenCalledWith(depositTradeHelper.address)
      .returns(true)
    fakePrice = await fakeUniswapV3OracleUintValueFixture()
    fakePrice.get.returns(TEST_ORACLE_PRICE)
    await core.tokenSender
      .connect(governance)
      .setAllowedMsgSenders(core.tokenSender.allowedMsgSenders.address)
    await core.tokenSender.connect(governance).setPriceOracle(fakePrice.address)
    await core.tokenSender.connect(governance).setAccountLimitPerPeriod(parseEther('100000000'))
    await core.rewardToken.connect(deployer).mint(core.tokenSender.address, parseEther('100000000'))
    await depositTradeHelper.connect(deployer).setWstethPoolId(WSTETH_ETH_METASTABLE_POOL_ID)
    await depositTradeHelper.connect(deployer).setTokenSender(core.tokenSender.address)
    await depositTradeHelper.connect(deployer).setTreasury(governance.address)
    await depositTradeHelper.connect(deployer).setTradeFeePercent(TEST_TRADE_FEE_PERCENT)
    await depositTradeHelper
      .connect(deployer)
      .setAmountMultiplier(ZERO_ADDRESS, TEST_REBATE_MULTIPLIER)
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

  describe('# wrapAndDeposit', () => {
    let expectedWstETHFromDepositSwap: BigNumber
    let balancerParamsForDeposit: IDepositTradeHelper.OffChainBalancerParamsStruct
    before(async () => {
      expectedWstETHFromDepositSwap = await getBalancerSingleSwapQuote(
        SwapKind.GIVEN_IN,
        TEST_DEPOSIT_AMOUNT,
        weth.address,
        wsteth.address
      )
      // Assuming 1% slippage for testing purposes
      balancerParamsForDeposit = {
        amountOutMinimum: expectedWstETHFromDepositSwap.mul(99).div(100),
        deadline: nowPlusMonths(1),
      }
    })

    it('reverts if funder has insufficient ETH', async () => {
      /**
       * Could just set to user's eth balance, because the gas cost
       * would be deducted from the user's balance, but this is less
       * fragile in the case the test net gas cost is set to 0.
       *
       * This uses rejectedWith rather than reverted because the transaction
       * in this case will not even be evaluated and rejected by the provider.
       */
      await expect(
        depositTradeHelper
          .connect(user)
          .wrapAndDeposit(user.address, JUNK_PAYLOAD, balancerParamsForDeposit, {
            value: (await user.getBalance()).add(1),
          })
      ).rejectedWith("sender doesn't have enough funds to send tx")
    })

    it('reverts if swap returns less than `amountOutMinimum`', async () => {
      const fakeWstethVault = await fakeVaultFixture()
      // Use fake vault so that recipient gets nothing
      fakeWstethVault.swap.returns()
      const depositTradeHelperForFakeVault = await depositTradeHelperFixture(
        core.collateral.address,
        swapRouter.address,
        fakeWstethVault.address
      )
      await depositTradeHelperForFakeVault.setTokenSender(core.tokenSender.address)

      await expect(
        depositTradeHelperForFakeVault
          .connect(user)
          .wrapAndDeposit(user.address, JUNK_PAYLOAD, balancerParamsForDeposit, {
            value: TEST_DEPOSIT_AMOUNT,
          })
      ).revertedWith('Insufficient wstETH from swap')
    })

    it('wraps ETH and swaps for wstETH if funder = recipient', async () => {
      const ethBalanceBefore = await user.getBalance()
      const collateralBalanceBefore = await core.collateral.balanceOf(user.address)

      const tx = await depositTradeHelper
        .connect(user)
        .wrapAndDeposit(user.address, JUNK_PAYLOAD, balancerParamsForDeposit, {
          value: TEST_DEPOSIT_AMOUNT,
        })

      await expect(tx)
        .to.emit(weth, 'Transfer')
        .withArgs(ethers.constants.AddressZero, wstethVault.address, TEST_DEPOSIT_AMOUNT)
      await expect(tx)
        .to.emit(wsteth, 'Transfer')
        .withArgs(wstethVault.address, depositTradeHelper.address, expectedWstETHFromDepositSwap)
      expect(await core.collateral.balanceOf(user.address)).eq(
        collateralBalanceBefore.add(
          await getCollateralAmountForDeposit(core.collateral, expectedWstETHFromDepositSwap)
        )
      )
      const receipt = await tx.wait()
      expect(await user.getBalance()).eq(
        ethBalanceBefore
          .sub(TEST_DEPOSIT_AMOUNT)
          .sub(receipt.gasUsed.mul(receipt.effectiveGasPrice))
      )
    })

    it('wraps ETH and swaps for wstETH if funder != recipient', async () => {
      const ethBalanceBefore = await user.getBalance()
      // Check if their balance is greater than 2x the deposit amount
      expect(ethBalanceBefore).gt(TEST_DEPOSIT_AMOUNT.mul(2))
      const collateralBalanceBefore = await core.collateral.balanceOf(deployer.address)

      const tx = await depositTradeHelper
        .connect(user)
        .wrapAndDeposit(deployer.address, JUNK_PAYLOAD, balancerParamsForDeposit, {
          value: TEST_DEPOSIT_AMOUNT,
        })

      await expect(tx)
        .emit(weth, 'Transfer')
        .withArgs(ethers.constants.AddressZero, wstethVault.address, TEST_DEPOSIT_AMOUNT)
      await expect(tx)
        .to.emit(wsteth, 'Transfer')
        .withArgs(wstethVault.address, depositTradeHelper.address, expectedWstETHFromDepositSwap)
      expect(await core.collateral.balanceOf(deployer.address)).eq(
        collateralBalanceBefore.add(
          await getCollateralAmountForDeposit(core.collateral, expectedWstETHFromDepositSwap)
        )
      )
      const receipt = await tx.wait()
      expect(await user.getBalance()).eq(
        ethBalanceBefore
          .sub(TEST_DEPOSIT_AMOUNT)
          .sub(receipt.gasUsed.mul(receipt.effectiveGasPrice))
      )
    })
  })

  describe('# withdrawAndUnwrap', () => {
    let collateralBalanceBefore: BigNumber
    let expectedWstETHFromWithdrawal: BigNumber
    let expectedWstETHFromDepositSwap: BigNumber
    let expectedWETHFromWithdrawSwap: BigNumber
    let collateralPermit: IDepositTradeHelper.PermitStruct
    let balancerParamsForDeposit: IDepositTradeHelper.OffChainBalancerParamsStruct
    let balancerParamsForWithdraw: IDepositTradeHelper.OffChainBalancerParamsStruct
    const DEPOSIT_TRADE_HELPER_REWARDS = parseEther('1')
    snapshotter.setupSnapshotContext('DepositTradeHelper-withdrawAndUnwrap')
    before(async () => {
      expectedWstETHFromDepositSwap = await getBalancerSingleSwapQuote(
        SwapKind.GIVEN_IN,
        TEST_DEPOSIT_AMOUNT,
        weth.address,
        wsteth.address
      )
      balancerParamsForDeposit = {
        amountOutMinimum: expectedWstETHFromDepositSwap.mul(99).div(100),
        deadline: nowPlusMonths(1),
      }
      await depositTradeHelper
        .connect(user)
        .wrapAndDeposit(user.address, JUNK_PAYLOAD, balancerParamsForDeposit, {
          value: TEST_DEPOSIT_AMOUNT,
        })
      collateralBalanceBefore = await core.collateral.balanceOf(user.address)
      collateralPermit = await getPermitFromSignature(
        core.collateral,
        user,
        depositTradeHelper.address,
        ethers.constants.MaxUint256,
        TEST_EXPIRY
      )
      expectedWstETHFromWithdrawal = await getBaseTokenAmountForWithdrawal(
        core.collateral,
        collateralBalanceBefore
      )
      expectedWETHFromWithdrawSwap = await getBalancerSingleSwapQuote(
        SwapKind.GIVEN_IN,
        expectedWstETHFromWithdrawal,
        wsteth.address,
        weth.address
      )
      balancerParamsForWithdraw = {
        amountOutMinimum: expectedWETHFromWithdrawSwap.mul(99).div(100),
        deadline: nowPlusMonths(1),
      }
      await snapshotter.saveSnapshot()
    })

    it('reverts if insufficient collateral', async () => {
      await core.collateral
        .connect(user)
        .approve(depositTradeHelper.address, collateralBalanceBefore.add(1))

      await expect(
        depositTradeHelper
          .connect(user)
          .withdrawAndUnwrap(
            deployer.address,
            collateralBalanceBefore.add(1),
            JUNK_PAYLOAD,
            JUNK_PERMIT,
            balancerParamsForWithdraw
          )
      ).revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('reverts if insufficient collateral approval', async () => {
      await core.collateral
        .connect(user)
        .approve(depositTradeHelper.address, collateralBalanceBefore.sub(1))

      await expect(
        depositTradeHelper
          .connect(user)
          .withdrawAndUnwrap(
            deployer.address,
            collateralBalanceBefore,
            JUNK_PAYLOAD,
            JUNK_PERMIT,
            balancerParamsForWithdraw
          )
      ).revertedWith('ERC20: insufficient allowance')
    })

    it('reverts if swap returns less than `amountOutMinimum`', async () => {
      const fakeWstethVault = await fakeVaultFixture()
      // Use fake vault so that recipient gets nothing
      fakeWstethVault.swap.returns()
      const depositTradeHelperForFakeVault = await depositTradeHelperFixture(
        core.collateral.address,
        swapRouter.address,
        fakeWstethVault.address
      )
      await depositTradeHelperForFakeVault.setTokenSender(core.tokenSender.address)
      const collateralPermitForFakeVault = await getPermitFromSignature(
        core.collateral,
        user,
        depositTradeHelperForFakeVault.address,
        ethers.constants.MaxUint256,
        TEST_EXPIRY
      )

      await expect(
        depositTradeHelperForFakeVault
          .connect(user)
          .withdrawAndUnwrap(
            deployer.address,
            collateralBalanceBefore,
            JUNK_PAYLOAD,
            collateralPermitForFakeVault,
            balancerParamsForWithdraw
          )
      ).revertedWith('Insufficient ETH from swap')
    })

    it('ignores collateral approval if deadline = 0', async () => {
      await core.collateral
        .connect(user)
        .approve(depositTradeHelper.address, collateralBalanceBefore)
      expect(JUNK_PERMIT.deadline).eq(0)

      await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          deployer.address,
          collateralBalanceBefore,
          JUNK_PAYLOAD,
          JUNK_PERMIT,
          balancerParamsForWithdraw
        )

      expect(core.collateral.permit).not.called
      expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).eq(0)
    })

    it('processes collateral permit if deadline != 0', async () => {
      expect(collateralPermit.deadline).not.eq(0)
      expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).not.eq(
        ethers.constants.MaxUint256
      )

      await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          deployer.address,
          collateralBalanceBefore,
          JUNK_PAYLOAD,
          collateralPermit,
          balancerParamsForWithdraw
        )

      expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).eq(
        ethers.constants.MaxUint256
      )
    })

    it('withdraws wstETH to DepositTradeHelper contract', async () => {
      const tx = await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          deployer.address,
          collateralBalanceBefore,
          JUNK_PAYLOAD,
          collateralPermit,
          balancerParamsForWithdraw
        )

      await expect(tx)
        .emit(core.baseToken, 'Transfer')
        .withArgs(core.collateral.address, depositTradeHelper.address, expectedWstETHFromWithdrawal)
    })

    it('swaps wstETH for WETH and unwraps to funder if funder = recipient', async () => {
      const recipientEthBefore = await user.getBalance()

      const tx = await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          user.address,
          collateralBalanceBefore,
          JUNK_PAYLOAD,
          collateralPermit,
          balancerParamsForWithdraw
        )

      const receipt = await tx.wait()
      expect(await user.getBalance()).eq(
        recipientEthBefore
          .add(expectedWETHFromWithdrawSwap)
          .sub(receipt.gasUsed.mul(receipt.effectiveGasPrice))
      )
    })

    it('swaps wstETH for WETH and unwraps to recipient if funder != recipient', async () => {
      const recipientEthBefore = await deployer.getBalance()

      await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          deployer.address,
          collateralBalanceBefore,
          JUNK_PAYLOAD,
          collateralPermit,
          balancerParamsForWithdraw
        )

      expect(await deployer.getBalance()).eq(recipientEthBefore.add(expectedWETHFromWithdrawSwap))
    })

    it('transfers reward token in the contract to recipient if funder = recipient', async () => {
      const recipientRewardsBefore = await core.rewardToken.balanceOf(user.address)
      await core.rewardToken.mint(depositTradeHelper.address, DEPOSIT_TRADE_HELPER_REWARDS)

      await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          user.address,
          collateralBalanceBefore,
          JUNK_PAYLOAD,
          collateralPermit,
          balancerParamsForWithdraw
        )

      expect(await core.rewardToken.balanceOf(user.address)).eq(
        recipientRewardsBefore.add(DEPOSIT_TRADE_HELPER_REWARDS)
      )
    })

    it('transfers reward token in the contract to recipient if funder != recipient', async () => {
      const recipientRewardsBefore = await core.rewardToken.balanceOf(deployer.address)
      await core.rewardToken.mint(depositTradeHelper.address, DEPOSIT_TRADE_HELPER_REWARDS)

      await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          deployer.address,
          collateralBalanceBefore,
          JUNK_PAYLOAD,
          collateralPermit,
          balancerParamsForWithdraw
        )

      expect(await core.rewardToken.balanceOf(deployer.address)).eq(
        recipientRewardsBefore.add(DEPOSIT_TRADE_HELPER_REWARDS)
      )
    })

    it("doesn't transfer reward token in contract if no contract balance", async () => {
      expect(await core.rewardToken.balanceOf(depositTradeHelper.address)).eq(0)

      const tx = await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          deployer.address,
          collateralBalanceBefore,
          JUNK_PAYLOAD,
          collateralPermit,
          balancerParamsForWithdraw
        )

      await expect(tx).not.emit(core.rewardToken, 'Transfer')
    })

    afterEach(() => {
      core.collateral.permit.reset()
    })
  })

  describe('trade testing', () => {
    let funder: SignerWithAddress
    let recipient: SignerWithAddress
    let univ3Factory: UniswapV3Factory
    let positionManager: NonfungiblePositionManager
    let governanceWstETHSwapParams: IVault.SingleSwapStruct
    let governanceWstETHFundingParams: IVault.FundManagementStruct
    let permitForFunder: IDepositTradeHelper.PermitStruct
    let permitForRecipient: IDepositTradeHelper.PermitStruct
    let balancerParamsForDeposit: IDepositTradeHelper.OffChainBalancerParamsStruct
    let uniswapParamsForTrade: IDepositTradeHelper.OffChainTradeParamsStruct
    let expectedCollateralBeforeFee: BigNumber
    let expectedCollateralAfterFee: BigNumber
    let expectedCollateralFee: BigNumber
    let expectedFeeRebate: BigNumber
    let estimatedCollateralSize: BigNumber
    let estimatedPositionSize: BigNumber
    const GOVERNANCE_COLLATERAL_SUPPLY = parseEther('120')
    snapshotter.setupSnapshotContext('DepositTradeHelper-TradeTesting')
    before(async () => {
      funder = user
      recipient = deployer
      // Mint governance wstETH to supply market liquidity for pools
      const wstethNeededForGovernance = await getBaseTokenAmountForDeposit(
        core.collateral,
        GOVERNANCE_COLLATERAL_SUPPLY
      )
      const ethNeededForGovernance = await getBalancerSingleSwapQuote(
        SwapKind.GIVEN_OUT,
        wstethNeededForGovernance,
        weth.address,
        wsteth.address
      )
      governanceWstETHSwapParams = {
        poolId: WSTETH_ETH_METASTABLE_POOL_ID,
        kind: SwapKind.GIVEN_OUT,
        assetIn: ZERO_ADDRESS,
        assetOut: wsteth.address,
        amount: wstethNeededForGovernance,
        userData: [],
      }
      governanceWstETHFundingParams = {
        sender: governance.address,
        fromInternalBalance: false,
        recipient: governance.address,
        toInternalBalance: false,
      }
      await wstethVault
        .connect(governance)
        .swap(
          governanceWstETHSwapParams,
          governanceWstETHFundingParams,
          ethers.constants.MaxUint256,
          nowPlusMonths(1),
          {
            value: ethNeededForGovernance.mul(101).div(100),
          }
        )
      univ3Factory = await attachUniV3Factory(
        ethers,
        getPrePOAddressForNetwork('UNIV3_FACTORY', 'arbitrumOne')
      )
      positionManager = await attachNonfungiblePositionManager(
        ethers,
        getPrePOAddressForNetwork('UNIV3_POSITION_MANAGER', 'arbitrumOne')
      )
      await core.mintLSFromBaseToken(
        governance,
        governance,
        /**
         * Divide by 3 because x Long needs to be matched with x Collateral
         * at 50/50, and repeated again for short, hence there needs to be a
         * 2:1 Collateral:LS ratio.
         */
        GOVERNANCE_COLLATERAL_SUPPLY.div(3),
        TEST_NAME_SUFFIX
      )
      await wsteth.connect(governance).approve(core.collateral.address, ethers.constants.MaxUint256)
      await core.mintCollateralFromBaseToken(
        governance,
        governance.address,
        // Need enough to supply to both pools
        GOVERNANCE_COLLATERAL_SUPPLY.div(3).mul(2)
      )
      await core.deployPoolsForMarket(
        TEST_NAME_SUFFIX,
        univ3Factory,
        TEST_FLOOR_PAYOUT.add(TEST_CEILING_PAYOUT).div(2),
        TEST_FLOOR_PAYOUT.add(TEST_CEILING_PAYOUT).div(2)
      )
      await mintLiquidityForLongShort(
        core.markets[TEST_NAME_SUFFIX].longToken,
        core.collateral,
        positionManager,
        TEST_FLOOR_PAYOUT,
        TEST_CEILING_PAYOUT,
        GOVERNANCE_COLLATERAL_SUPPLY.div(3),
        GOVERNANCE_COLLATERAL_SUPPLY.div(3),
        governance.address,
        governance
      )
      await mintLiquidityForLongShort(
        core.markets[TEST_NAME_SUFFIX].shortToken,
        core.collateral,
        positionManager,
        TEST_FLOOR_PAYOUT,
        TEST_CEILING_PAYOUT,
        GOVERNANCE_COLLATERAL_SUPPLY.div(3),
        GOVERNANCE_COLLATERAL_SUPPLY.div(3),
        governance.address,
        governance
      )
      await snapshotter.saveSnapshot()
    })

    describe('# tradeForPosition', () => {
      const TEST_COLLATERAL_AMOUNT = parseEther('1')
      snapshotter.setupSnapshotContext('DepositTradeHelper-TradeTesting-tradeForPosition')
      before(async () => {
        await core.collateral.connect(governance).transfer(funder.address, TEST_COLLATERAL_AMOUNT)
        expectedCollateralFee = TEST_COLLATERAL_AMOUNT.mul(TEST_TRADE_FEE_PERCENT).div(PERCENT_UNIT)
        expectedCollateralAfterFee = TEST_COLLATERAL_AMOUNT.sub(expectedCollateralFee)
        expectedFeeRebate = expectedCollateralFee
          .mul(TEST_REBATE_MULTIPLIER)
          .div(PERCENT_UNIT)
          .mul(parseEther('1'))
          .div(TEST_ORACLE_PRICE)
        permitForFunder = await getPermitFromSignature(
          core.collateral,
          funder,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_EXPIRY
        )
        estimatedPositionSize = await getAmountOutForExactInputSingle(
          quoter,
          core.collateral.address,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          expectedCollateralAfterFee
        )
        uniswapParamsForTrade = {
          positionToken: core.markets[TEST_NAME_SUFFIX].longToken.address,
          deadline: TEST_EXPIRY,
          amountOutMinimum: estimatedPositionSize.mul(995).div(1000),
          sqrtPriceLimitX96: 0,
        }
        await snapshotter.saveSnapshot()
      })

      it('reverts if invalid position token passed in', async () => {
        const wrongTokenOutUniswapParams = {
          ...uniswapParamsForTrade,
          positionToken: wsteth.address,
        }

        // Uniswap does not revert with an explicit error if token pair does not exist
        await expect(
          depositTradeHelper
            .connect(funder)
            .tradeForPosition(
              recipient.address,
              TEST_COLLATERAL_AMOUNT,
              permitForFunder,
              wrongTokenOutUniswapParams
            )
        ).reverted
      })

      it('reverts if position received < slippage tolerance', async () => {
        const wrongTokenOutUniswapParams = {
          ...uniswapParamsForTrade,
          amountOutMinimum: estimatedPositionSize.mul(101).div(100),
        }

        await expect(
          depositTradeHelper
            .connect(funder)
            .tradeForPosition(
              recipient.address,
              TEST_COLLATERAL_AMOUNT,
              permitForFunder,
              wrongTokenOutUniswapParams
            )
        ).revertedWith('Too little received')
      })

      it('transfers fee to treasury and rebate to recipient if recipient = funder', async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const funderCollateralBefore = await core.collateral.balanceOf(funder.address)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForPosition(
            recipient.address,
            TEST_COLLATERAL_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx)
          .emit(core.rewardToken, 'Transfer')
          .withArgs(core.tokenSender.address, funder.address, expectedFeeRebate)
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(
          funderRewardTokenBefore.add(expectedFeeRebate)
        )
        expect(await core.collateral.balanceOf(funder.address)).eq(
          funderCollateralBefore.sub(TEST_COLLATERAL_AMOUNT)
        )
      })

      it('transfers fee to treasury and rebate to recipient if recipient != funder', async () => {
        expect(recipient).not.eq(funder)
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        const funderCollateralBefore = await core.collateral.balanceOf(funder.address)
        const recipientCollateralBefore = await core.collateral.balanceOf(recipient.address)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForPosition(
            recipient.address,
            TEST_COLLATERAL_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx)
          .emit(core.rewardToken, 'Transfer')
          .withArgs(core.tokenSender.address, recipient.address, expectedFeeRebate)
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(
          recipientRewardTokenBefore.add(expectedFeeRebate)
        )
        expect(await core.collateral.balanceOf(funder.address)).eq(
          funderCollateralBefore.sub(TEST_COLLATERAL_AMOUNT)
        )
        expect(await core.collateral.balanceOf(recipient.address)).eq(recipientCollateralBefore)
      })

      it('transfers fee but not rebate if token sender not set and recipient = funder', async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        await depositTradeHelper.connect(deployer).setTokenSender(ZERO_ADDRESS)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForPosition(
            recipient.address,
            TEST_COLLATERAL_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
      })

      it('transfers fee but not rebate if token sender not set and recipient != funder', async () => {
        expect(recipient).not.eq(funder)
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        await depositTradeHelper.connect(deployer).setTokenSender(ZERO_ADDRESS)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForPosition(
            recipient.address,
            TEST_COLLATERAL_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(recipientRewardTokenBefore)
      })

      it('transfers fee but not rebate if multiplier = 0 and recipient = funder', async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        await depositTradeHelper.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 0)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForPosition(
            recipient.address,
            TEST_COLLATERAL_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
      })

      it('transfers fee but not rebate if multiplier = 0 and recipient != funder', async () => {
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        await depositTradeHelper.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 0)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForPosition(
            recipient.address,
            TEST_COLLATERAL_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(recipientRewardTokenBefore)
      })

      it('transfers fee but not rebate if scaled fee rounds down to 0 from multiplier < 1 and recipient = funder', async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        await depositTradeHelper.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 1)
        /**
         * Collateral amount * helper fee (known) / fee unit * multiplier (known) / multiplier unit = 0
         * In integer division, this means collateral amount * helper fee / fee unit must equal 999999 (multiplier unit - 1)
         */
        const collateralForScaledFeeRoundToZero = BigNumber.from(PERCENT_UNIT - 1)
          .mul(PERCENT_UNIT)
          .div(TEST_TRADE_FEE_PERCENT)
        const expectedCollateralFeeForScaledFeeRoundToZero = collateralForScaledFeeRoundToZero
          .mul(TEST_TRADE_FEE_PERCENT)
          .div(PERCENT_UNIT)
        expect(expectedCollateralFeeForScaledFeeRoundToZero).gt(0)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForPosition(recipient.address, collateralForScaledFeeRoundToZero, permitForFunder, {
            /**
             * Since we are deviating from the amounts every other test uses, we need to change the
             * slippage parameters. Setting to 0 for these testcases for simplicity since these are
             * already complicated enough and there is no point testing slippage here.
             */
            ...uniswapParamsForTrade,
            amountOutMinimum: 0,
          })

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(
            depositTradeHelper.address,
            governance.address,
            expectedCollateralFeeForScaledFeeRoundToZero
          )
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFeeForScaledFeeRoundToZero)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
      })

      it('transfers fee but not rebate if scaled fee rounds down to 0 from multiplier < 1 and recipient != funder', async () => {
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        await depositTradeHelper.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 1)
        const collateralForScaledFeeRoundToZero = BigNumber.from(PERCENT_UNIT - 1)
          .mul(PERCENT_UNIT)
          .div(TEST_TRADE_FEE_PERCENT)
        const expectedCollateralFeeForScaledFeeRoundToZero = collateralForScaledFeeRoundToZero
          .mul(TEST_TRADE_FEE_PERCENT)
          .div(PERCENT_UNIT)
        expect(expectedCollateralFeeForScaledFeeRoundToZero).gt(0)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForPosition(recipient.address, collateralForScaledFeeRoundToZero, permitForFunder, {
            ...uniswapParamsForTrade,
            amountOutMinimum: 0,
          })

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(
            depositTradeHelper.address,
            governance.address,
            expectedCollateralFeeForScaledFeeRoundToZero
          )
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFeeForScaledFeeRoundToZero)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(recipientRewardTokenBefore)
      })

      it("doesn't transfer fee or rebate if fee percent = 0 and recipient = funder", async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        await depositTradeHelper.connect(deployer).setTradeFeePercent(0)

        await depositTradeHelper
          .connect(funder)
          .tradeForPosition(
            recipient.address,
            TEST_COLLATERAL_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(await core.collateral.balanceOf(governance.address)).eq(treasuryCollateralBefore)
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
      })

      it("doesn't transfer fee or rebate if fee percent = 0 and recipient != funder", async () => {
        expect(recipient).not.eq(funder)
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        await depositTradeHelper.connect(deployer).setTradeFeePercent(0)

        await depositTradeHelper
          .connect(funder)
          .tradeForPosition(
            recipient.address,
            TEST_COLLATERAL_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(await core.collateral.balanceOf(governance.address)).eq(treasuryCollateralBefore)
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(recipientRewardTokenBefore)
      })

      it('sends long/short position from swap to funder if recipient = funder', async () => {
        recipient = funder
        const funderLongTokenBefore = await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(
          funder.address
        )

        await depositTradeHelper
          .connect(funder)
          .tradeForPosition(
            recipient.address,
            TEST_COLLATERAL_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(funder.address)).eq(
          funderLongTokenBefore.add(estimatedPositionSize)
        )
      })

      it('sends long/short position from swap to funder if recipient != funder', async () => {
        expect(recipient).not.eq(funder)
        const funderLongTokenBefore = await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(
          funder.address
        )
        const recipientLongTokenBefore = await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(
          recipient.address
        )

        await depositTradeHelper
          .connect(funder)
          .tradeForPosition(
            recipient.address,
            TEST_COLLATERAL_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(funder.address)).eq(
          funderLongTokenBefore
        )
        expect(await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(recipient.address)).eq(
          recipientLongTokenBefore.add(estimatedPositionSize)
        )
      })
    })

    describe('# tradeForCollateral', () => {
      const TEST_POSITION_AMOUNT = parseEther('1')
      snapshotter.setupSnapshotContext('DepositTradeHelper-TradeTesting-tradeForCollateral')
      before(async () => {
        /**
         * Mint collateral and subsequently test long position for user
         * to swap for Collateral. Need enough for 2 swaps since one test
         * requires a swap to be done twice.
         */
        const wstethNeededForTestPosition = await getBaseTokenAmountForDeposit(
          core.collateral,
          TEST_POSITION_AMOUNT.mul(2)
        )
        const ethNeededForTestPosition = await getBalancerSingleSwapQuote(
          SwapKind.GIVEN_OUT,
          wstethNeededForTestPosition,
          weth.address,
          wsteth.address
        )
        balancerParamsForDeposit = {
          amountOutMinimum: 0,
          deadline: TEST_EXPIRY,
        }
        await depositTradeHelper
          .connect(funder)
          .wrapAndDeposit(funder.address, JUNK_PAYLOAD, balancerParamsForDeposit, {
            value: ethNeededForTestPosition,
          })
        await core.collateral
          .connect(funder)
          .approve(core.markets[TEST_NAME_SUFFIX].address, TEST_POSITION_AMOUNT.mul(2))
        await core.markets[TEST_NAME_SUFFIX].connect(funder).mint(
          TEST_POSITION_AMOUNT.mul(2),
          funder.address,
          JUNK_PAYLOAD
        )
        // Generate parameters for trading in this test block
        permitForFunder = await getPermitFromSignature(
          core.markets[TEST_NAME_SUFFIX].longToken,
          funder,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_EXPIRY
        )
        estimatedCollateralSize = await getAmountOutForExactInputSingle(
          quoter,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          core.collateral.address,
          TEST_POSITION_AMOUNT
        )
        uniswapParamsForTrade = {
          positionToken: core.markets[TEST_NAME_SUFFIX].longToken.address,
          deadline: TEST_EXPIRY,
          amountOutMinimum: estimatedCollateralSize.mul(995).div(1000),
          sqrtPriceLimitX96: 0,
        }
        expectedCollateralFee = estimatedCollateralSize
          .mul(TEST_TRADE_FEE_PERCENT)
          .div(PERCENT_UNIT)
        expectedFeeRebate = expectedCollateralFee
          .mul(TEST_REBATE_MULTIPLIER)
          .div(PERCENT_UNIT)
          .mul(parseEther('1'))
          .div(TEST_ORACLE_PRICE)
        expectedCollateralAfterFee = estimatedCollateralSize.sub(expectedCollateralFee)
        await snapshotter.saveSnapshot()
      })

      it('reverts if invalid position token passed in', async () => {
        const wrongTokenOutUniswapParams = {
          ...uniswapParamsForTrade,
          positionToken: wsteth.address,
        }

        // Uniswap does not revert with an explicit error if token pair does not exist
        await expect(
          depositTradeHelper
            .connect(funder)
            .tradeForCollateral(
              recipient.address,
              TEST_POSITION_AMOUNT,
              permitForFunder,
              wrongTokenOutUniswapParams
            )
        ).reverted
      })

      it('reverts if position received < slippage tolerance', async () => {
        const wrongTokenOutUniswapParams = {
          ...uniswapParamsForTrade,
          amountOutMinimum: estimatedCollateralSize.mul(101).div(100),
        }

        await expect(
          depositTradeHelper
            .connect(funder)
            .tradeForCollateral(
              recipient.address,
              TEST_POSITION_AMOUNT,
              permitForFunder,
              wrongTokenOutUniswapParams
            )
        ).revertedWith('Too little received')
      })

      it('ignores position token approval if deadline = 0', async () => {
        await core.markets[TEST_NAME_SUFFIX].longToken
          .connect(funder)
          .approve(depositTradeHelper.address, TEST_POSITION_AMOUNT)
        expect(JUNK_PERMIT.deadline).eq(0)

        await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            JUNK_PERMIT,
            uniswapParamsForTrade
          )

        expect(
          await core.markets[TEST_NAME_SUFFIX].longToken.allowance(
            funder.address,
            depositTradeHelper.address
          )
        ).eq(0)
      })

      it('processes position token permit if deadline != 0', async () => {
        expect(permitForFunder.deadline).not.eq(0)
        expect(
          await core.markets[TEST_NAME_SUFFIX].longToken.allowance(
            funder.address,
            depositTradeHelper.address
          )
        ).not.eq(ethers.constants.MaxUint256)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.markets[TEST_NAME_SUFFIX].longToken, 'Approval')
          .withArgs(funder.address, depositTradeHelper.address, ethers.constants.MaxUint256)
        expect(
          await core.markets[TEST_NAME_SUFFIX].longToken.allowance(
            funder.address,
            depositTradeHelper.address
          )
        ).eq(ethers.constants.MaxUint256)
      })

      it('processes position token permit if deadline != 0 and approval already given', async () => {
        /**
         * We do not check if a user already has given approval on-chain,
         * we expect the FE to simply pass in a JUNK_PERMIT to tell us
         * whether to skip approvals.
         */
        await core.markets[TEST_NAME_SUFFIX].longToken
          .connect(funder)
          .approve(depositTradeHelper.address, ethers.constants.MaxUint256)
        expect(permitForFunder.deadline).not.eq(0)
        expect(
          await core.markets[TEST_NAME_SUFFIX].longToken.allowance(
            funder.address,
            depositTradeHelper.address
          )
        ).eq(ethers.constants.MaxUint256)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.markets[TEST_NAME_SUFFIX].longToken, 'Approval')
          .withArgs(funder.address, depositTradeHelper.address, ethers.constants.MaxUint256)
        expect(
          await core.markets[TEST_NAME_SUFFIX].longToken.allowance(
            funder.address,
            depositTradeHelper.address
          )
        ).eq(ethers.constants.MaxUint256)
      })

      it('gives unlimited position token approval to swap router', async () => {
        expect(
          await core.markets[TEST_NAME_SUFFIX].longToken.allowance(
            depositTradeHelper.address,
            swapRouter.address
          )
        ).eq(0)

        await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(
          await core.markets[TEST_NAME_SUFFIX].longToken.allowance(
            depositTradeHelper.address,
            swapRouter.address
          )
        ).eq(ethers.constants.MaxUint256)
      })

      it('skips position token approval if swap router already has unlimited approval', async () => {
        /**
         * For the allowance between the SwapRouter and DepositTradeHelper, unlike
         * the allowance with the user, we have no choice but to detect on-chain
         * whether an approval is still needed.
         */
        await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )
        // Recalculate parameters for second swap
        estimatedCollateralSize = await getAmountOutForExactInputSingle(
          quoter,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          core.collateral.address,
          TEST_POSITION_AMOUNT
        )
        uniswapParamsForTrade = {
          positionToken: core.markets[TEST_NAME_SUFFIX].longToken.address,
          deadline: TEST_EXPIRY,
          amountOutMinimum: estimatedCollateralSize.mul(995).div(1000),
          sqrtPriceLimitX96: 0,
        }

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            JUNK_PERMIT,
            uniswapParamsForTrade
          )

        await expect(tx).not.emit(core.markets[TEST_NAME_SUFFIX].longToken, 'Approval')
      })

      it("takes funder's position tokens if recipient = funder", async () => {
        recipient = funder
        const funderPositionTokenBefore = await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(
          funder.address
        )

        await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(funder.address)).eq(
          funderPositionTokenBefore.sub(TEST_POSITION_AMOUNT)
        )
      })

      it("takes funder's position tokens if recipient != funder", async () => {
        expect(recipient).not.eq(funder)
        const funderPositionTokenBefore = await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(
          funder.address
        )
        const recipientPositionTokenBefore = await core.markets[
          TEST_NAME_SUFFIX
        ].longToken.balanceOf(recipient.address)

        await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(funder.address)).eq(
          funderPositionTokenBefore.sub(TEST_POSITION_AMOUNT)
        )
        expect(await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(recipient.address)).eq(
          recipientPositionTokenBefore
        )
      })

      it('transfers fee to treasury and rebate to recipient if recipient = funder', async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx)
          .emit(core.rewardToken, 'Transfer')
          .withArgs(core.tokenSender.address, funder.address, expectedFeeRebate)
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(
          funderRewardTokenBefore.add(expectedFeeRebate)
        )
      })

      it('transfers fee to treasury and rebate to recipient if recipient != funder', async () => {
        expect(recipient).not.eq(funder)
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx)
          .emit(core.rewardToken, 'Transfer')
          .withArgs(core.tokenSender.address, recipient.address, expectedFeeRebate)
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(
          recipientRewardTokenBefore.add(expectedFeeRebate)
        )
      })

      it('transfers fee but not rebate if token sender not set and recipient = funder', async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        await depositTradeHelper.connect(deployer).setTokenSender(ZERO_ADDRESS)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
      })

      it('transfers fee but not rebate if token sender not set and recipient != funder', async () => {
        expect(recipient).not.eq(funder)
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        await depositTradeHelper.connect(deployer).setTokenSender(ZERO_ADDRESS)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(recipientRewardTokenBefore)
      })

      it('transfers fee but not rebate if multiplier = 0 and recipient = funder', async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        await depositTradeHelper.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 0)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
      })

      it('transfers fee but not rebate if multiplier = 0 and recipient != funder', async () => {
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        await depositTradeHelper.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 0)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(recipientRewardTokenBefore)
      })

      it('transfers fee but not rebate if scaled fee rounds to 0 from multiplier < 1 and recipient = funder', async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        await depositTradeHelper.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 1)
        /**
         * The setup for the tests returning Collateral are much more complicated, because we need to
         * obtain an estimate for how much position we need to trade to get a Collateral amount that
         * would result in a scaled fee of 0.
         *
         * collateral amount * helper fee (known) / fee unit * multiplier (known) / multiplier unit = 0
         * In integer division, this means collateral amount * helper fee / fee unit must equal 999999 (multiplier unit - 1)
         */
        const collateralForScaledFeeRoundToZero = BigNumber.from(PERCENT_UNIT - 1)
          .mul(PERCENT_UNIT)
          .div(TEST_TRADE_FEE_PERCENT)
        const positionForScaledFeeRoundToZero = await getAmountInForExactOutputSingle(
          quoter,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          core.collateral.address,
          collateralForScaledFeeRoundToZero
        )
        const expectedCollateralFeeForScaledFeeRoundToZero = collateralForScaledFeeRoundToZero
          .mul(TEST_TRADE_FEE_PERCENT)
          .div(PERCENT_UNIT)
        expect(expectedCollateralFeeForScaledFeeRoundToZero).gt(0)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(recipient.address, positionForScaledFeeRoundToZero, permitForFunder, {
            ...uniswapParamsForTrade,
            amountOutMinimum: 0,
          })

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(
            depositTradeHelper.address,
            governance.address,
            expectedCollateralFeeForScaledFeeRoundToZero
          )
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFeeForScaledFeeRoundToZero)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
      })

      it('transfers fee but not rebate if scaled fee rounds to 0 from multiplier < 1 and recipient != funder', async () => {
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        await depositTradeHelper.connect(deployer).setAmountMultiplier(ZERO_ADDRESS, 1)
        const collateralForScaledFeeRoundToZero = BigNumber.from(PERCENT_UNIT - 1)
          .mul(PERCENT_UNIT)
          .div(TEST_TRADE_FEE_PERCENT)
        const positionForScaledFeeRoundToZero = await getAmountInForExactOutputSingle(
          quoter,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          core.collateral.address,
          collateralForScaledFeeRoundToZero
        )
        const expectedCollateralFeeForScaledFeeRoundToZero = collateralForScaledFeeRoundToZero
          .mul(TEST_TRADE_FEE_PERCENT)
          .div(PERCENT_UNIT)
        expect(expectedCollateralFeeForScaledFeeRoundToZero).gt(0)

        const tx = await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(recipient.address, positionForScaledFeeRoundToZero, permitForFunder, {
            ...uniswapParamsForTrade,
            amountOutMinimum: 0,
          })

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(
            depositTradeHelper.address,
            governance.address,
            expectedCollateralFeeForScaledFeeRoundToZero
          )
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFeeForScaledFeeRoundToZero)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(recipientRewardTokenBefore)
      })

      it("doesn't transfer fee or rebate if fee percent = 0 and recipient = funder", async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        await depositTradeHelper.connect(deployer).setTradeFeePercent(0)

        await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(await core.collateral.balanceOf(governance.address)).eq(treasuryCollateralBefore)
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
      })

      it("doesn't transfer fee or rebate if fee percent = 0 and recipient != funder", async () => {
        expect(recipient).not.eq(funder)
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        await depositTradeHelper.connect(deployer).setTradeFeePercent(0)

        await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(await core.collateral.balanceOf(governance.address)).eq(treasuryCollateralBefore)
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(recipientRewardTokenBefore)
      })

      it('sends collateral from swap to funder if recipient = funder', async () => {
        recipient = funder
        const funderCollateralBefore = await core.collateral.balanceOf(funder.address)

        await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(await core.collateral.balanceOf(funder.address)).eq(
          funderCollateralBefore.add(expectedCollateralAfterFee)
        )
      })

      it('sends collateral from swap to funder if recipient != funder', async () => {
        expect(recipient).not.eq(funder)
        const funderCollateralBefore = await core.collateral.balanceOf(funder.address)
        const recipientCollateralBefore = await core.collateral.balanceOf(recipient.address)

        await depositTradeHelper
          .connect(funder)
          .tradeForCollateral(
            recipient.address,
            TEST_POSITION_AMOUNT,
            permitForFunder,
            uniswapParamsForTrade
          )

        expect(await core.collateral.balanceOf(funder.address)).eq(funderCollateralBefore)
        expect(await core.collateral.balanceOf(recipient.address)).eq(
          recipientCollateralBefore.add(expectedCollateralAfterFee)
        )
      })
    })

    describe('# wrapAndDepositAndTrade', () => {
      let expectedWstethFromSwap: BigNumber
      snapshotter.setupSnapshotContext('DepositTradeHelper-TradeTesting-wrapAndDepositAndTrade')
      before(async () => {
        expectedWstethFromSwap = await getBalancerSingleSwapQuote(
          SwapKind.GIVEN_IN,
          TEST_DEPOSIT_AMOUNT,
          weth.address,
          wsteth.address
        )
        permitForFunder = await getPermitFromSignature(
          core.collateral,
          funder,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_EXPIRY
        )
        permitForRecipient = await getPermitFromSignature(
          core.collateral,
          recipient,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_EXPIRY
        )
        // Assuming 0.5% slippage for testing purposes
        balancerParamsForDeposit = {
          amountOutMinimum: expectedWstethFromSwap.mul(995).div(1000),
          deadline: TEST_EXPIRY,
        }
        expectedCollateralBeforeFee = await getCollateralAmountForDeposit(
          core.collateral,
          expectedWstethFromSwap
        )
        expectedCollateralFee = expectedCollateralBeforeFee
          .mul(TEST_TRADE_FEE_PERCENT)
          .div(PERCENT_UNIT)
        expectedCollateralAfterFee = expectedCollateralBeforeFee.sub(expectedCollateralFee)
        expectedFeeRebate = expectedCollateralFee
          .mul(TEST_REBATE_MULTIPLIER)
          .div(PERCENT_UNIT)
          .mul(parseEther('1'))
          .div(TEST_ORACLE_PRICE)
        estimatedPositionSize = await getAmountOutForExactInputSingle(
          quoter,
          core.collateral.address,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          expectedCollateralAfterFee
        )
        uniswapParamsForTrade = {
          positionToken: core.markets[TEST_NAME_SUFFIX].longToken.address,
          deadline: TEST_EXPIRY,
          amountOutMinimum: estimatedPositionSize.mul(995).div(1000),
          sqrtPriceLimitX96: 0,
        }
        await snapshotter.saveSnapshot()
      })

      it('reverts if invalid position token passed in', async () => {
        const wrongTokenOutUniswapParams = {
          ...uniswapParamsForTrade,
          positionToken: wsteth.address,
        }

        // Uniswap does not revert with an explicit error if token pair does not exist
        await expect(
          depositTradeHelper
            .connect(funder)
            .wrapAndDepositAndTrade(
              recipient.address,
              JUNK_PAYLOAD,
              balancerParamsForDeposit,
              permitForRecipient,
              wrongTokenOutUniswapParams,
              {
                value: TEST_DEPOSIT_AMOUNT,
              }
            )
        ).reverted
      })

      it('reverts if position received < slippage tolerance', async () => {
        const wrongTokenOutUniswapParams = {
          ...uniswapParamsForTrade,
          amountOutMinimum: estimatedPositionSize.mul(101).div(100),
        }

        await expect(
          depositTradeHelper
            .connect(funder)
            .wrapAndDepositAndTrade(
              recipient.address,
              JUNK_PAYLOAD,
              balancerParamsForDeposit,
              permitForRecipient,
              wrongTokenOutUniswapParams,
              {
                value: TEST_DEPOSIT_AMOUNT,
              }
            )
        ).revertedWith('Too little received')
      })

      it('takes ETH from funder', async () => {
        const ethBalanceBefore = await funder.getBalance()

        const tx = await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForRecipient,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        const receipt = await tx.wait()
        expect(await funder.getBalance()).eq(
          ethBalanceBefore.sub(
            TEST_DEPOSIT_AMOUNT.add(receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice))
          )
        )
      })

      it('takes newly minted Collateral from funder if recipient = funder', async () => {
        recipient = funder
        expect(await core.collateral.balanceOf(funder.address)).eq(0)

        const tx = await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForFunder,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(funder.address, depositTradeHelper.address, expectedCollateralBeforeFee)
      })

      it('takes newly minted Collateral from recipient if recipient != funder', async () => {
        expect(recipient.address).not.eq(funder.address)
        expect(await core.collateral.balanceOf(funder.address)).eq(0)

        const tx = await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForRecipient,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(recipient.address, depositTradeHelper.address, expectedCollateralBeforeFee)
      })

      it('transfers fee to treasury and rebate to recipient if recipient = funder', async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)

        const tx = await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForFunder,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx)
          .emit(core.rewardToken, 'Transfer')
          .withArgs(core.tokenSender.address, funder.address, expectedFeeRebate)
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(
          funderRewardTokenBefore.add(expectedFeeRebate)
        )
      })

      it('transfers fee to treasury and rebate to recipient if recipient != funder', async () => {
        expect(recipient).not.eq(funder)
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)

        const tx = await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForRecipient,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx)
          .emit(core.rewardToken, 'Transfer')
          .withArgs(core.tokenSender.address, recipient.address, expectedFeeRebate)
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(
          recipientRewardTokenBefore.add(expectedFeeRebate)
        )
      })

      it('transfers fee but not rebate if token sender not configured and recipient = funder', async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        await depositTradeHelper.connect(deployer).setTokenSender(ZERO_ADDRESS)

        const tx = await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForFunder,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
      })

      it('transfers fee but not rebate if token sender not configured and recipient != funder', async () => {
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        await depositTradeHelper.connect(deployer).setTokenSender(ZERO_ADDRESS)

        const tx = await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForRecipient,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        await expect(tx)
          .emit(core.collateral, 'Transfer')
          .withArgs(depositTradeHelper.address, governance.address, expectedCollateralFee)
        await expect(tx).not.emit(core.rewardToken, 'Transfer')
        expect(await core.collateral.balanceOf(governance.address)).eq(
          treasuryCollateralBefore.add(expectedCollateralFee)
        )
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(recipientRewardTokenBefore)
      })

      it("doesn't transfer fee or rebate if fee = 0 and recipient = funder", async () => {
        recipient = funder
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        await depositTradeHelper.connect(deployer).setTradeFeePercent(0)

        await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForFunder,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        expect(await core.collateral.balanceOf(governance.address)).eq(treasuryCollateralBefore)
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
      })

      it("doesn't transfer fee or rebate if fee = 0 and recipient != funder", async () => {
        expect(recipient).not.eq(funder)
        const treasuryCollateralBefore = await core.collateral.balanceOf(governance.address)
        const funderRewardTokenBefore = await core.rewardToken.balanceOf(funder.address)
        const recipientRewardTokenBefore = await core.rewardToken.balanceOf(recipient.address)
        await depositTradeHelper.connect(deployer).setTradeFeePercent(0)

        await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForRecipient,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        expect(await core.collateral.balanceOf(governance.address)).eq(treasuryCollateralBefore)
        expect(await core.rewardToken.balanceOf(funder.address)).eq(funderRewardTokenBefore)
        expect(await core.rewardToken.balanceOf(recipient.address)).eq(recipientRewardTokenBefore)
      })

      it('sends long/short position from swap to funder if recipient = funder', async () => {
        recipient = funder
        const funderLongBalanceBefore = await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(
          funder.address
        )

        await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForFunder,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        expect(await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(funder.address)).eq(
          funderLongBalanceBefore.add(estimatedPositionSize)
        )
      })

      it('sends long/short position from swap to recipient if recipient != funder', async () => {
        expect(recipient.address).not.eq(funder.address)
        const funderLongBalanceBefore = await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(
          funder.address
        )
        const recipientLongBalanceBefore = await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(
          recipient.address
        )

        await depositTradeHelper
          .connect(funder)
          .wrapAndDepositAndTrade(
            recipient.address,
            JUNK_PAYLOAD,
            balancerParamsForDeposit,
            permitForRecipient,
            uniswapParamsForTrade,
            {
              value: TEST_DEPOSIT_AMOUNT,
            }
          )

        expect(await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(funder.address)).eq(
          funderLongBalanceBefore
        )
        expect(await core.markets[TEST_NAME_SUFFIX].longToken.balanceOf(recipient.address)).eq(
          recipientLongBalanceBefore.add(estimatedPositionSize)
        )
      })
    })

    afterEach(() => {
      // Reset recipient to deployer
      recipient = deployer
    })
  })
})
