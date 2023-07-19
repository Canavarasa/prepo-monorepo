import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumberish } from 'ethers'
import { parseEther } from '@ethersproject/units'
import { id } from 'ethers/lib/utils'
import { ARBITRAGE_BROKER_ROLES, POOL_FEE_TIER } from 'prepo-constants'
import { utils, snapshots, getRolesAccountDoesNotHave } from 'prepo-hardhat'
import { revertsIfNotRoleHolder } from '../utils'
import { arbitrageBrokerFixture } from '../fixtures/ArbitrageBrokerFixture'
import { fakeAccountListFixture } from '../fixtures/HookFixture'
import { fakeLongShortTokenFixture } from '../fixtures/LongShortTokenFixture'
import { fakePrePOMarketFixture } from '../fixtures/PrePOMarketFixture'
import { fakeSwapRouterFixture } from '../fixtures/UniswapFixtures'
import { MockCoreWithMockBaseToken } from '../../harnesses/mock'
import { roleAssigners } from '../../helpers'
import {
  AccountList,
  ArbitrageBroker,
  IArbitrageBroker,
  LongShortToken,
  PrePOMarket,
  SwapRouter,
} from '../../types/generated'
import { PromiseOrValue } from '../../types/generated/common'

chai.use(smock.matchers)
const { nowPlusMonths } = utils
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> ArbitrageBroker', () => {
  let core: MockCoreWithMockBaseToken
  let deployer: SignerWithAddress
  let governance: SignerWithAddress
  let swapRouter: FakeContract<SwapRouter>
  let marketList: FakeContract<AccountList>
  let market: FakeContract<PrePOMarket>
  let longToken: FakeContract<LongShortToken>
  let shortToken: FakeContract<LongShortToken>
  let arbitrageBroker: ArbitrageBroker
  let correctBuyLongArgs: PromiseOrValue<BigNumberish>[]
  let correctBuyShortArgs: PromiseOrValue<BigNumberish>[]
  let correctSellLongArgs: PromiseOrValue<BigNumberish>[]
  let correctSellShortArgs: PromiseOrValue<BigNumberish>[]

  const tradingCapitalBefore = parseEther('1')
  const tradingCapitalAfter = parseEther('10')
  const tradeParams = <IArbitrageBroker.OffChainTradeParamsStruct>{
    deadline: nowPlusMonths(2),
    longShortAmount: parseEther('1'),
    collateralLimitForLong: parseEther('2'),
    collateralLimitForShort: parseEther('3'),
  }
  const SWAP_ARG_COUNT = 8

  snapshotter.setupSnapshotContext('ArbitrageBroker')
  before(async () => {
    core = await MockCoreWithMockBaseToken.Instance.init(ethers)
    ;[deployer, governance] = core.accounts
    swapRouter = await fakeSwapRouterFixture()
    marketList = await fakeAccountListFixture()
    arbitrageBroker = await arbitrageBrokerFixture(core.collateral.address, swapRouter.address)
    await roleAssigners.assignArbitrageBrokerRoles(deployer, governance, arbitrageBroker)
    market = await fakePrePOMarketFixture()
    longToken = await fakeLongShortTokenFixture()
    shortToken = await fakeLongShortTokenFixture()
    market.getLongToken.returns(longToken.address)
    market.getShortToken.returns(shortToken.address)
    correctBuyLongArgs = [
      core.collateral.address,
      longToken.address,
      POOL_FEE_TIER,
      arbitrageBroker.address,
      tradeParams.deadline,
      tradeParams.longShortAmount,
      tradeParams.collateralLimitForLong,
      0,
    ]
    correctBuyShortArgs = [
      core.collateral.address,
      shortToken.address,
      POOL_FEE_TIER,
      arbitrageBroker.address,
      tradeParams.deadline,
      tradeParams.longShortAmount,
      tradeParams.collateralLimitForShort,
      0,
    ]
    correctSellLongArgs = [longToken.address as PromiseOrValue<BigNumberish>]
      .concat(core.collateral.address as PromiseOrValue<BigNumberish>)
      .concat(correctBuyLongArgs.slice(2))
    correctSellShortArgs = [shortToken.address as PromiseOrValue<BigNumberish>]
      .concat(core.collateral.address as PromiseOrValue<BigNumberish>)
      .concat(correctBuyShortArgs.slice(2))
    await snapshotter.saveSnapshot()
  })

  describe('initial state', () => {
    it('sets collateral from constructor', async () => {
      expect(await arbitrageBroker.getCollateral()).eq(core.collateral.address)
    })

    it('sets swap router from constructor', async () => {
      expect(await arbitrageBroker.getSwapRouter()).eq(swapRouter.address)
    })

    it('gives swap router unlimited collateral approval', async () => {
      expect(await core.collateral.allowance(arbitrageBroker.address, swapRouter.address)).eq(
        ethers.constants.MaxUint256
      )
    })

    it('sets role constants', async () => {
      expect(await arbitrageBroker.BUY_AND_REDEEM_ROLE()).eq(id('buyAndRedeem'))
      expect(await arbitrageBroker.MINT_AND_SELL_ROLE()).eq(id('mintAndSell'))
      expect(await arbitrageBroker.SET_ACCOUNT_LIST_ROLE()).eq(id('setAccountList'))
      expect(await arbitrageBroker.WITHDRAW_ERC20_ROLE()).eq(id('withdrawERC20'))
    })

    it('assigns all roles to deployer', async () => {
      const rolesDeployerDoesNotHave = await getRolesAccountDoesNotHave(
        arbitrageBroker,
        deployer.address,
        ARBITRAGE_BROKER_ROLES
      )

      expect(rolesDeployerDoesNotHave.length).eq(0)
    })
  })

  describe('# setAccountList', () => {
    it('reverts if not role holder', async () => {
      await revertsIfNotRoleHolder(
        arbitrageBroker.SET_ACCOUNT_LIST_ROLE(),
        arbitrageBroker.populateTransaction.setAccountList(marketList.address)
      )
    })

    it('succeeds if role holder', async () => {
      await arbitrageBroker.connect(governance).setAccountList(marketList.address)
    })
  })

  describe('# withdrawERC20(address[])', () => {
    it('reverts if not role holder', async () => {
      await revertsIfNotRoleHolder(
        arbitrageBroker.WITHDRAW_ERC20_ROLE(),
        arbitrageBroker.populateTransaction['withdrawERC20(address[])']([])
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await arbitrageBroker.hasRole(
          await arbitrageBroker.WITHDRAW_ERC20_ROLE(),
          governance.address
        )
      ).to.eq(true)

      await arbitrageBroker.connect(governance)['withdrawERC20(address[])']([])
    })
  })

  describe('# withdrawERC20(address[],uint256[])', () => {
    it('reverts if not role holder', async () => {
      await revertsIfNotRoleHolder(
        arbitrageBroker.WITHDRAW_ERC20_ROLE(),
        arbitrageBroker.populateTransaction['withdrawERC20(address[],uint256[])']([], [])
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await arbitrageBroker.hasRole(
          await arbitrageBroker.WITHDRAW_ERC20_ROLE(),
          governance.address
        )
      ).to.eq(true)

      await arbitrageBroker.connect(governance)['withdrawERC20(address[],uint256[])']([], [])
    })
  })

  // TODO add ArbitrageProfit event emission test
  describe('# buyAndRedeem', () => {
    beforeEach(async () => {
      marketList.isIncluded.whenCalledWith(market.address).returns(true)
      await arbitrageBroker.connect(governance).setAccountList(marketList.address)
      market.redeem.returns()
      core.collateral.balanceOf.returnsAtCall(0, tradingCapitalBefore)
      core.collateral.balanceOf.returnsAtCall(1, tradingCapitalAfter)
    })

    it('reverts if not role holder', async () => {
      await revertsIfNotRoleHolder(
        arbitrageBroker.BUY_AND_REDEEM_ROLE(),
        arbitrageBroker.populateTransaction.buyAndRedeem(market.address, tradeParams)
      )
    })

    it('reverts if market not valid', async () => {
      const invalidMarket = await fakePrePOMarketFixture()
      expect(await marketList.isIncluded(invalidMarket.address)).eq(false)

      await expect(
        arbitrageBroker.connect(governance).buyAndRedeem(invalidMarket.address, tradeParams)
      )
        .revertedWithCustomError(arbitrageBroker, 'InvalidMarket')
        .withArgs(invalidMarket.address)
    })

    it('reverts if long swap reverts', async () => {
      swapRouter.exactOutputSingle.whenCalledWith(correctBuyLongArgs).reverts()

      await expect(
        arbitrageBroker.connect(governance).callStatic.buyAndRedeem(market.address, tradeParams)
      ).reverted
    })

    it('reverts if short swap reverts', async () => {
      swapRouter.exactOutputSingle.whenCalledWith(correctBuyShortArgs).reverts()

      await expect(
        arbitrageBroker.connect(governance).callStatic.buyAndRedeem(market.address, tradeParams)
      ).reverted
    })

    it('reverts if profit exactly 0', async () => {
      core.collateral.balanceOf.returnsAtCall(0, tradingCapitalBefore)
      core.collateral.balanceOf.returnsAtCall(1, tradingCapitalBefore)

      await expect(
        arbitrageBroker.connect(governance).callStatic.buyAndRedeem(market.address, tradeParams)
      )
        .revertedWithCustomError(arbitrageBroker, 'UnprofitableTrade')
        .withArgs(tradingCapitalBefore, tradingCapitalBefore)
    })

    it('reverts if loss taken', async () => {
      core.collateral.balanceOf.returnsAtCall(0, tradingCapitalBefore)
      core.collateral.balanceOf.returnsAtCall(1, tradingCapitalBefore.sub(1))

      await expect(
        arbitrageBroker.connect(governance).callStatic.buyAndRedeem(market.address, tradeParams)
      )
        .revertedWithCustomError(arbitrageBroker, 'UnprofitableTrade')
        .withArgs(tradingCapitalBefore, tradingCapitalBefore.sub(1))
    })

    it('gives unlimited approval to SwapRouter and Market', async () => {
      expect(await core.collateral.allowance(arbitrageBroker.address, market.address)).eq(0)
      expect(await longToken.allowance(arbitrageBroker.address, swapRouter.address)).eq(0)
      expect(await shortToken.allowance(arbitrageBroker.address, swapRouter.address)).eq(0)

      await arbitrageBroker.connect(governance).callStatic.buyAndRedeem(market.address, tradeParams)

      expect(core.collateral.approve).calledWith(market.address, ethers.constants.MaxUint256)
      expect(longToken.approve).calledWith(swapRouter.address, ethers.constants.MaxUint256)
      expect(shortToken.approve).calledWith(swapRouter.address, ethers.constants.MaxUint256)
    })

    it("doesn't give approval to SwapRouter and Market if already approved", async () => {
      core.collateral.allowance
        .whenCalledWith(arbitrageBroker.address, market.address)
        .returns(ethers.constants.MaxUint256)
      longToken.allowance
        .whenCalledWith(arbitrageBroker.address, swapRouter.address)
        .returns(ethers.constants.MaxUint256)
      shortToken.allowance
        .whenCalledWith(arbitrageBroker.address, swapRouter.address)
        .returns(ethers.constants.MaxUint256)

      await arbitrageBroker.connect(governance).callStatic.buyAndRedeem(market.address, tradeParams)

      expect(core.collateral.approve).not.called
      expect(longToken.approve).not.called
      expect(shortToken.approve).not.called
    })

    it('buys long token first', async () => {
      await arbitrageBroker.connect(governance).callStatic.buyAndRedeem(market.address, tradeParams)

      const swapRouterCallArgs = swapRouter.exactOutputSingle
        .atCall(0)
        .callHistory[0].args[0].slice(0, SWAP_ARG_COUNT)
      swapRouterCallArgs.forEach((arg, i) => {
        expect(arg).eq(correctBuyLongArgs[i])
      })
    })

    it('buys short token after long', async () => {
      await arbitrageBroker.connect(governance).callStatic.buyAndRedeem(market.address, tradeParams)

      const swapRouterCallArgs = swapRouter.exactOutputSingle
        .atCall(1)
        .callHistory[0].args[0].slice(0, SWAP_ARG_COUNT)
      swapRouterCallArgs.forEach((arg, i) => {
        expect(arg).eq(correctBuyShortArgs[i])
      })
    })

    it('redeems after buying both', async () => {
      await arbitrageBroker.connect(governance).callStatic.buyAndRedeem(market.address, tradeParams)

      expect(swapRouter.exactOutputSingle.atCall(1)).calledImmediatelyBefore(market.redeem)
      expect(market.redeem).calledWith(
        tradeParams.longShortAmount,
        tradeParams.longShortAmount,
        arbitrageBroker.address,
        '0x'
      )
    })

    it('returns profit earned and swap input values', async () => {
      const testAmountInForLongSwap = parseEther('1')
      const testAmountInForShortSwap = parseEther('2')
      swapRouter.exactOutputSingle
        .whenCalledWith(correctBuyLongArgs)
        .returns(testAmountInForLongSwap)
      swapRouter.exactOutputSingle
        .whenCalledWith(correctBuyShortArgs)
        .returns(testAmountInForShortSwap)

      const buyAndRedeemReturnValues = await arbitrageBroker
        .connect(governance)
        .callStatic.buyAndRedeem(market.address, tradeParams)

      expect(buyAndRedeemReturnValues.profit).eq(tradingCapitalAfter.sub(tradingCapitalBefore))
      expect(buyAndRedeemReturnValues.collateralToBuyLong).eq(testAmountInForLongSwap)
      expect(buyAndRedeemReturnValues.collateralToBuyShort).eq(testAmountInForShortSwap)
    })

    afterEach(() => {
      core.collateral.allowance.reset()
      core.collateral.approve.reset()
      core.collateral.balanceOf.reset()
      longToken.allowance.reset()
      longToken.approve.reset()
      market.redeem.reset()
      marketList.isIncluded.reset()
      shortToken.allowance.reset()
      shortToken.approve.reset()
      swapRouter.exactOutputSingle.reset()
    })
  })

  // TODO add ArbitrageProfit event emission test
  describe('# mintAndSell', () => {
    beforeEach(async () => {
      marketList.isIncluded.whenCalledWith(market.address).returns(true)
      await arbitrageBroker.connect(governance).setAccountList(marketList.address)
      market.mint.returns()
      core.collateral.balanceOf.returnsAtCall(0, tradingCapitalBefore)
      core.collateral.balanceOf.returnsAtCall(1, tradingCapitalAfter)
    })

    it('reverts if not role holder', async () => {
      await revertsIfNotRoleHolder(
        arbitrageBroker.MINT_AND_SELL_ROLE(),
        arbitrageBroker.populateTransaction.mintAndSell(market.address, tradeParams)
      )
    })

    it('reverts if market not valid', async () => {
      const invalidMarket = await fakePrePOMarketFixture()
      expect(await marketList.isIncluded(invalidMarket.address)).eq(false)

      await expect(
        arbitrageBroker.connect(governance).mintAndSell(invalidMarket.address, tradeParams)
      )
        .revertedWithCustomError(arbitrageBroker, 'InvalidMarket')
        .withArgs(invalidMarket.address)
    })

    it('reverts if profit exactly 0', async () => {
      core.collateral.balanceOf.returnsAtCall(0, tradingCapitalBefore)
      core.collateral.balanceOf.returnsAtCall(1, tradingCapitalBefore)

      await expect(
        arbitrageBroker.connect(governance).callStatic.mintAndSell(market.address, tradeParams)
      )
        .revertedWithCustomError(arbitrageBroker, 'UnprofitableTrade')
        .withArgs(tradingCapitalBefore, tradingCapitalBefore)
    })

    it('reverts if loss taken', async () => {
      core.collateral.balanceOf.returnsAtCall(0, tradingCapitalBefore)
      core.collateral.balanceOf.returnsAtCall(1, tradingCapitalBefore.sub(1))

      await expect(
        arbitrageBroker.connect(governance).callStatic.mintAndSell(market.address, tradeParams)
      )
        .revertedWithCustomError(arbitrageBroker, 'UnprofitableTrade')
        .withArgs(tradingCapitalBefore, tradingCapitalBefore.sub(1))
    })

    it('reverts if long swap reverts', async () => {
      swapRouter.exactInputSingle.whenCalledWith(correctSellLongArgs).reverts()

      await expect(
        arbitrageBroker.connect(governance).callStatic.mintAndSell(market.address, tradeParams)
      ).reverted
    })

    it('reverts if short swap reverts', async () => {
      swapRouter.exactInputSingle.whenCalledWith(correctSellShortArgs).reverts()

      await expect(
        arbitrageBroker.connect(governance).callStatic.mintAndSell(market.address, tradeParams)
      ).reverted
    })

    it('gives unlimited approval to SwapRouter and Market', async () => {
      expect(await core.collateral.allowance(arbitrageBroker.address, market.address)).eq(0)
      expect(await longToken.allowance(arbitrageBroker.address, swapRouter.address)).eq(0)
      expect(await shortToken.allowance(arbitrageBroker.address, swapRouter.address)).eq(0)

      await arbitrageBroker.connect(governance).callStatic.mintAndSell(market.address, tradeParams)

      expect(core.collateral.approve).calledWith(market.address, ethers.constants.MaxUint256)
      expect(longToken.approve).calledWith(swapRouter.address, ethers.constants.MaxUint256)
      expect(shortToken.approve).calledWith(swapRouter.address, ethers.constants.MaxUint256)
    })

    it("doesn't give approval to SwapRouter and Market if already approved", async () => {
      core.collateral.allowance
        .whenCalledWith(arbitrageBroker.address, market.address)
        .returns(ethers.constants.MaxUint256)
      longToken.allowance
        .whenCalledWith(arbitrageBroker.address, swapRouter.address)
        .returns(ethers.constants.MaxUint256)
      shortToken.allowance
        .whenCalledWith(arbitrageBroker.address, swapRouter.address)
        .returns(ethers.constants.MaxUint256)

      await arbitrageBroker.connect(governance).callStatic.mintAndSell(market.address, tradeParams)

      expect(core.collateral.approve).not.called
      expect(longToken.approve).not.called
      expect(shortToken.approve).not.called
    })

    it('mints positions before selling long', async () => {
      await arbitrageBroker.connect(governance).callStatic.mintAndSell(market.address, tradeParams)

      expect(swapRouter.exactInputSingle.atCall(0)).calledAfter(market.mint)
      expect(market.mint).calledWith(tradeParams.longShortAmount, arbitrageBroker.address, '0x')
    })

    it('sells long token after minting', async () => {
      await arbitrageBroker.connect(governance).callStatic.mintAndSell(market.address, tradeParams)

      const swapRouterCallArgs = swapRouter.exactInputSingle
        .atCall(0)
        .callHistory[0].args[0].slice(0, SWAP_ARG_COUNT)
      swapRouterCallArgs.forEach((arg, i) => {
        expect(arg).eq(correctSellLongArgs[i])
      })
    })

    it('sells short token after selling long', async () => {
      await arbitrageBroker.connect(governance).callStatic.mintAndSell(market.address, tradeParams)

      const swapRouterCallArgs = swapRouter.exactInputSingle
        .atCall(1)
        .callHistory[0].args[0].slice(0, SWAP_ARG_COUNT)
      swapRouterCallArgs.forEach((arg, i) => {
        expect(arg).eq(correctSellShortArgs[i])
      })
    })

    it('returns profit earned and swap output values', async () => {
      const testAmountOutForLongSwap = parseEther('1')
      const testAmountOutForShortSwap = parseEther('2')
      swapRouter.exactInputSingle
        .whenCalledWith(correctSellLongArgs)
        .returns(testAmountOutForLongSwap)
      swapRouter.exactInputSingle
        .whenCalledWith(correctSellShortArgs)
        .returns(testAmountOutForShortSwap)

      const mintAndSellReturnValues = await arbitrageBroker
        .connect(governance)
        .callStatic.mintAndSell(market.address, tradeParams)

      expect(mintAndSellReturnValues.profit).eq(tradingCapitalAfter.sub(tradingCapitalBefore))
      expect(mintAndSellReturnValues.collateralFromSellingLong).eq(testAmountOutForLongSwap)
      expect(mintAndSellReturnValues.collateralFromSellingShort).eq(testAmountOutForShortSwap)
    })

    afterEach(() => {
      core.collateral.allowance.reset()
      core.collateral.approve.reset()
      core.collateral.balanceOf.reset()
      longToken.allowance.reset()
      longToken.approve.reset()
      market.mint.reset()
      marketList.isIncluded.reset()
      shortToken.allowance.reset()
      shortToken.approve.reset()
      swapRouter.exactInputSingle.reset()
    })
  })
})
