import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { stub, SinonStub } from 'sinon'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber } from 'ethers'
import { getPrePOAddressForNetwork } from 'prepo-constants'
import { utils, snapshots } from 'prepo-hardhat'
import { parseEther } from '@ethersproject/units'
import {
  arbitrageBrokerFixture,
  fakeArbitrageBrokerFixture,
} from '../fixtures/ArbitrageBrokerFixture'
import { create2DeployerFixture } from '../fixtures/Create2DeployerFixtures'
import { fakeAccountListFixture } from '../fixtures/HookFixture'
import { MockCoreWithMockBaseToken } from '../../harnesses/mock'
import { roleAssigners } from '../../helpers/roles'
import {
  attachNonfungiblePositionManager,
  attachSwapRouter,
  attachUniV3Factory,
  attachQuoter,
  mintLiquidityForLongShort,
  getAmountInForExactOutputSingle,
  getAmountOutForExactInputSingle,
  getPoolPriceInWei,
} from '../../helpers/uniswap'
import { StandaloneCreateMarketParams } from '../../types'
import {
  AccountList,
  Create2Deployer,
  UniswapV3Factory,
  NonfungiblePositionManager,
  ArbitrageBroker,
  IArbitrageBroker,
  SwapRouter,
  Quoter,
} from '../../types/generated'
/**
 * Import entire module just for Sinon mocking since Sinon
 * requires whole module when creating a fake.
 */
import * as ArbitragePools from '../../scripts/ArbitragePools'
import {
  ArbitrageStrategy,
  attachArbitrageBroker,
  executeTrade,
  executeTradeIfProfitable,
  getAdjustedEstimate,
  getEstimateGivenTradeSize,
  getIdealTradeSize,
  getNextTradeSize,
  getPoolsFromTokens,
  getSlippageFactor,
  getStrategyToUse,
  getTokensFromMarket,
  getWeiPricesFromPools,
} from '../../scripts/ArbitragePools'

const { nowPlusMonths } = utils

chai.use(smock.matchers)
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> Arbitrage Trading', () => {
  let quoter: Quoter
  let core: MockCoreWithMockBaseToken
  let deployer: SignerWithAddress
  let governance: SignerWithAddress
  let defaultMarketParams: StandaloneCreateMarketParams
  let create2Deployer: Create2Deployer
  let univ3Factory: UniswapV3Factory
  let positionManager: NonfungiblePositionManager
  let swapRouter: SwapRouter
  let marketList: FakeContract<AccountList>
  let arbitrageBroker: ArbitrageBroker
  const TEST_NAME_SUFFIX = 'Fake Token ($5-10B)'
  const TEST_SYMBOL_SUFFIX = 'FAKE_5-10B'
  const TEST_FLOOR_PAYOUT = parseEther('0.2')
  const TEST_CEILING_PAYOUT = parseEther('0.8')
  const TEST_EXPIRY_PAYOUT = parseEther('0.5')
  const TEST_FLOOR_VAL = 5
  const TEST_CEILING_VAL = 10
  const TEST_EXPIRY = nowPlusMonths(2)
  const TEST_POSITION_SIZE = parseEther('1')
  /**
   * Default deadline just uses our existing `nowPlusMonth()` function
   * for simplicity. If we were to use a much closer deadline, perhaps
   * now + some seconds, we would need to poll the current block time
   * for every testcase to ensure the deadline stays valid.
   */
  const TEST_DEADLINE = nowPlusMonths(1)
  const GOVERNANCE_COLLATERAL_SUPPLY = parseEther('10000')
  const GOVERNANCE_LSTOKEN_SUPPLY = parseEther('10000')
  /**
   * Since L/S tokens will be priced at < 1 Collateral, so supplying
   * twice the Long and Short amount we plan to buy in Collateral is
   * more than sufficient, and is not a magic number.
   *
   * Collateral will be used to purchase Long and Short tokens if long
   * price + short price < 1 Collateral. Therefore it will be more than
   * sufficient to supply 1 Collateral in broker capital per Long+Short
   * token to be purchased for redemption.
   */
  const TEST_BROKER_CAPITAL = TEST_POSITION_SIZE.mul(2)

  snapshotter.setupSnapshotContext('ArbitrageTrading')
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
            blockNumber: 46247692,
          },
        },
      ],
    })
    quoter = await attachQuoter(ethers, getPrePOAddressForNetwork('UNIV3_QUOTER', 'arbitrumOne'))
    core = await MockCoreWithMockBaseToken.Instance.init(ethers)
    ;[deployer, governance] = core.accounts
    await core.baseToken.connect(deployer).mint(governance.address, parseEther('100000'))
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
    /**
     * Connect to existing Uniswap V3 contracts and deploy pools
     * for the Long and Short tokens.
     */
    univ3Factory = await attachUniV3Factory(
      ethers,
      getPrePOAddressForNetwork('UNIV3_FACTORY', 'arbitrumOne')
    )
    positionManager = await attachNonfungiblePositionManager(
      ethers,
      getPrePOAddressForNetwork('UNIV3_POSITION_MANAGER', 'arbitrumOne')
    )
    swapRouter = await attachSwapRouter(
      ethers,
      getPrePOAddressForNetwork('UNIV3_SWAP_ROUTER', 'arbitrumOne')
    )
    // Only need to assign deposit fee since test is only using deposit
    await roleAssigners.assignCollateralRoles(deployer, governance, core.collateral)
    await core.collateral.connect(governance).setDepositFeePercent(10000)
    // Supply governance with Collateral and LongShort tokens
    await core.mintLSFromBaseToken(
      governance,
      governance,
      GOVERNANCE_COLLATERAL_SUPPLY,
      TEST_NAME_SUFFIX
    )
    await core.mintCollateralFromBaseToken(
      governance,
      governance.address,
      GOVERNANCE_LSTOKEN_SUPPLY
    )
    // Setup ArbitrageBroker and supply it with trading capital for testing
    arbitrageBroker = await arbitrageBrokerFixture(core.collateral.address, swapRouter.address)
    await roleAssigners.assignArbitrageBrokerRoles(deployer, governance, arbitrageBroker)
    marketList = await fakeAccountListFixture()
    marketList.isIncluded.whenCalledWith(core.markets[TEST_NAME_SUFFIX].address).returns(true)
    await arbitrageBroker.connect(governance).setAccountList(marketList.address)
    await core.collateral.connect(governance).transfer(arbitrageBroker.address, TEST_BROKER_CAPITAL)
    await snapshotter.saveSnapshot()
  })

  describe('# ArbitrageBroker Integration Testing', () => {
    describe('# buyAndRedeem', () => {
      it('reverts if profit < 0', async () => {
        // initialize pools at 0.5 so buying will occur at a loss
        await core.deployPoolsForMarket(
          TEST_NAME_SUFFIX,
          univ3Factory,
          parseEther('0.5'),
          parseEther('0.5')
        )
        /**
         * Since we must provide liquidity across a range, we can just
         * supply L/S liquidity at 0.5-0.51 to both, ensuring that
         * L + S will exceed 1. Note that these ether values are
         * approximate and helpers convert this to an actual tick
         * price, so in reality 0.5-0.51 is 0.496-0.506. However, this
         * will still result in a loss since overall L + S > 1.
         *
         * The price curve is not linear and will lean heavily towards the upper
         * end of the range if we only provide just enough or a little over the
         * amount we plan to buy. We supply twice the amount we plan to buy to
         * ensure the average purchase price is closer to the middle of the range.
         *
         * We provide a Collateral amount of 0 since the range of 0.496-0.506 is
         * above the current price 0.496 and therefore only uses L/S tokens;
         * i.e. buying L/S tokens will be facilitated but not selling into Collateral.
         */
        await mintLiquidityForLongShort(
          core.markets[TEST_NAME_SUFFIX].longToken,
          core.collateral,
          positionManager,
          parseEther('0.5'),
          parseEther('0.51'),
          TEST_POSITION_SIZE.mul(2),
          BigNumber.from(0),
          governance.address,
          governance
        )
        await mintLiquidityForLongShort(
          core.markets[TEST_NAME_SUFFIX].shortToken,
          core.collateral,
          positionManager,
          parseEther('0.5'),
          parseEther('0.51'),
          TEST_POSITION_SIZE.mul(2),
          BigNumber.from(0),
          governance.address,
          governance
        )
        /**
         * Simulate the swap to determine how much it will cost to purchase
         * each. This is for verifying the expected profit/loss and the script
         * won't need to do this.
         */
        const expectedCollateralToBuyLong = await getAmountInForExactOutputSingle(
          quoter,
          core.collateral.address,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          TEST_POSITION_SIZE
        )
        const expectedCollateralToBuyShort = await getAmountInForExactOutputSingle(
          quoter,
          core.collateral.address,
          core.markets[TEST_NAME_SUFFIX].shortToken.address,
          TEST_POSITION_SIZE
        )
        /**
         * Expected profit is the combined redemption value of the L/S tokens,
         * minus the cost of buying them.
         */
        const expectedProfit = TEST_POSITION_SIZE.sub(
          expectedCollateralToBuyLong.add(expectedCollateralToBuyShort)
        )
        expect(expectedProfit).lt(0)
        const brokerBalanceBefore = await core.collateral.balanceOf(arbitrageBroker.address)
        const tradeParams = <IArbitrageBroker.OffChainTradeParamsStruct>{
          deadline: TEST_DEADLINE,
          longShortAmount: TEST_POSITION_SIZE,
          collateralLimitForLong: ethers.constants.MaxUint256,
          collateralLimitForShort: ethers.constants.MaxUint256,
        }

        await expect(
          arbitrageBroker
            .connect(governance)
            .buyAndRedeem(core.markets[TEST_NAME_SUFFIX].address, tradeParams)
        )
          .revertedWithCustomError(arbitrageBroker, 'UnprofitableTrade')
          .withArgs(brokerBalanceBefore, brokerBalanceBefore.add(expectedProfit))
      })

      it('succeeds if profit > 0', async () => {
        // initialize pools at 0.49 so buying will occur at a profit
        await core.deployPoolsForMarket(
          TEST_NAME_SUFFIX,
          univ3Factory,
          parseEther('0.49'),
          parseEther('0.49')
        )
        /**
         * 0.49-0.5 will actually be ~0.486-0.496. However, this
         * will still result in a profit since overall L + S < 1.
         */
        await mintLiquidityForLongShort(
          core.markets[TEST_NAME_SUFFIX].longToken,
          core.collateral,
          positionManager,
          parseEther('0.49'),
          parseEther('0.5'),
          TEST_POSITION_SIZE.mul(2),
          BigNumber.from(0),
          governance.address,
          governance
        )
        await mintLiquidityForLongShort(
          core.markets[TEST_NAME_SUFFIX].shortToken,
          core.collateral,
          positionManager,
          parseEther('0.49'),
          parseEther('0.5'),
          TEST_POSITION_SIZE.mul(2),
          BigNumber.from(0),
          governance.address,
          governance
        )
        const expectedCollateralToBuyLong = await getAmountInForExactOutputSingle(
          quoter,
          core.collateral.address,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          TEST_POSITION_SIZE
        )
        const expectedCollateralToBuyShort = await getAmountInForExactOutputSingle(
          quoter,
          core.collateral.address,
          core.markets[TEST_NAME_SUFFIX].shortToken.address,
          TEST_POSITION_SIZE
        )
        const expectedProfit = TEST_POSITION_SIZE.sub(
          expectedCollateralToBuyLong.add(expectedCollateralToBuyShort)
        )
        expect(expectedProfit).gt(0)
        const brokerBalanceBefore = await core.collateral.balanceOf(arbitrageBroker.address)
        const tradeParams = <IArbitrageBroker.OffChainTradeParamsStruct>{
          deadline: TEST_DEADLINE,
          longShortAmount: TEST_POSITION_SIZE,
          collateralLimitForLong: ethers.constants.MaxUint256,
          collateralLimitForShort: ethers.constants.MaxUint256,
        }

        await arbitrageBroker
          .connect(governance)
          .buyAndRedeem(core.markets[TEST_NAME_SUFFIX].address, tradeParams)

        expect(await core.collateral.balanceOf(arbitrageBroker.address)).eq(
          brokerBalanceBefore.add(expectedProfit)
        )
      })
    })

    describe('# mintAndSell', () => {
      it('reverts if profit < 0', async () => {
        /**
         * Initialize pools at 0.5 so selling begins at a loss.
         * Liquidity will be provided down to 0.49 to ensure overall
         * L + S < 1. Conversely from `buyAndRedeem()` cases, we only
         * provide Collateral rather than L/S.
         */
        await core.deployPoolsForMarket(
          TEST_NAME_SUFFIX,
          univ3Factory,
          parseEther('0.5'),
          parseEther('0.5')
        )
        /**
         * The price curve is not linear and will lean heavily towards the lower
         * end of the range if we only provide just enough or a little over the
         * amount we plan to sell. We supply twice the amount we plan to sell to
         * ensure the average sale price is closer to the middle of the range.
         */
        await mintLiquidityForLongShort(
          core.markets[TEST_NAME_SUFFIX].longToken,
          core.collateral,
          positionManager,
          parseEther('0.49'),
          parseEther('0.5'),
          BigNumber.from(0),
          TEST_POSITION_SIZE.mul(2),
          governance.address,
          governance
        )
        await mintLiquidityForLongShort(
          core.markets[TEST_NAME_SUFFIX].shortToken,
          core.collateral,
          positionManager,
          parseEther('0.49'),
          parseEther('0.5'),
          BigNumber.from(0),
          TEST_POSITION_SIZE.mul(2),
          governance.address,
          governance
        )
        /**
         * Simulate the swap to determine how much each sale would return.
         * This is for verifying the expected profit/loss and the script
         * won't need to do this.
         */
        const expectedCollateralFromSellingLong = await getAmountOutForExactInputSingle(
          quoter,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          core.collateral.address,
          TEST_POSITION_SIZE
        )
        const expectedCollateralFromSellingShort = await getAmountOutForExactInputSingle(
          quoter,
          core.markets[TEST_NAME_SUFFIX].shortToken.address,
          core.collateral.address,
          TEST_POSITION_SIZE
        )
        /**
         * Expected profit is the amount the L/S tokens sold for minus the cost
         * of minting them.
         */
        const expectedProfit = expectedCollateralFromSellingLong
          .add(expectedCollateralFromSellingShort)
          .sub(TEST_POSITION_SIZE)
        expect(expectedProfit).lt(0)
        const brokerBalanceBefore = await core.collateral.balanceOf(arbitrageBroker.address)
        const tradeParams = <IArbitrageBroker.OffChainTradeParamsStruct>{
          deadline: TEST_DEADLINE,
          longShortAmount: TEST_POSITION_SIZE,
          collateralLimitForLong: 0,
          collateralLimitForShort: 0,
        }

        await expect(
          arbitrageBroker
            .connect(governance)
            .mintAndSell(core.markets[TEST_NAME_SUFFIX].address, tradeParams)
        )
          .revertedWithCustomError(arbitrageBroker, 'UnprofitableTrade')
          .withArgs(brokerBalanceBefore, brokerBalanceBefore.add(expectedProfit))
      })

      it('succeeds if profit > 0', async () => {
        /**
         * Initialize pools at 0.51 so selling begins at a
         * profit. Liquidity will be provided down to 0.5 to
         * ensure overall L + S > 1.
         */
        await core.deployPoolsForMarket(
          TEST_NAME_SUFFIX,
          univ3Factory,
          parseEther('0.51'),
          parseEther('0.51')
        )
        await mintLiquidityForLongShort(
          core.markets[TEST_NAME_SUFFIX].longToken,
          core.collateral,
          positionManager,
          parseEther('0.5'),
          parseEther('0.51'),
          BigNumber.from(0),
          TEST_POSITION_SIZE.mul(2),
          governance.address,
          governance
        )
        await mintLiquidityForLongShort(
          core.markets[TEST_NAME_SUFFIX].shortToken,
          core.collateral,
          positionManager,
          parseEther('0.5'),
          parseEther('0.51'),
          BigNumber.from(0),
          TEST_POSITION_SIZE.mul(2),
          governance.address,
          governance
        )
        const expectedCollateralFromSellingLong = await getAmountOutForExactInputSingle(
          quoter,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          core.collateral.address,
          TEST_POSITION_SIZE
        )
        const expectedCollateralFromSellingShort = await getAmountOutForExactInputSingle(
          quoter,
          core.markets[TEST_NAME_SUFFIX].shortToken.address,
          core.collateral.address,
          TEST_POSITION_SIZE
        )
        const expectedProfit = expectedCollateralFromSellingLong
          .add(expectedCollateralFromSellingShort)
          .sub(TEST_POSITION_SIZE)
        expect(expectedProfit).gt(0)
        const brokerBalanceBefore = await core.collateral.balanceOf(arbitrageBroker.address)
        const tradeParams = <IArbitrageBroker.OffChainTradeParamsStruct>{
          deadline: TEST_DEADLINE,
          longShortAmount: TEST_POSITION_SIZE,
          collateralLimitForLong: 0,
          collateralLimitForShort: 0,
        }

        await arbitrageBroker
          .connect(governance)
          .mintAndSell(core.markets[TEST_NAME_SUFFIX].address, tradeParams)

        expect(await core.collateral.balanceOf(arbitrageBroker.address)).eq(
          brokerBalanceBefore.add(expectedProfit)
        )
      })
    })
  })

  describe('Arbitrage Script Integration Testing', () => {
    const TEST_SPREAD = parseEther('0.01')
    describe('# getTokensFromMarket', () => {
      it('returns market tokens', async () => {
        const tokens = await getTokensFromMarket(
          ethers.provider,
          core.markets[TEST_NAME_SUFFIX].address
        )

        expect(tokens.longToken.address).eq(await core.markets[TEST_NAME_SUFFIX].longToken.address)
        expect(tokens.shortToken.address).eq(
          await core.markets[TEST_NAME_SUFFIX].shortToken.address
        )
      })
    })

    describe('# getWeiPricesFromPools', () => {
      beforeEach(async () => {
        // Use different prices to prevent false positives
        await core.deployPoolsForMarket(
          TEST_NAME_SUFFIX,
          univ3Factory,
          parseEther('0.49'),
          parseEther('0.5')
        )
      })

      it('returns wei prices for pools', async () => {
        const expectedLongPoolPrice = await getPoolPriceInWei(
          ethers,
          univ3Factory,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          core.collateral.address
        )
        const expectedShortPoolPrice = await getPoolPriceInWei(
          ethers,
          univ3Factory,
          core.markets[TEST_NAME_SUFFIX].shortToken.address,
          core.collateral.address
        )
        const pools = await getPoolsFromTokens(
          ethers.provider,
          core.collateral.address,
          core.markets[TEST_NAME_SUFFIX].longToken.address,
          core.markets[TEST_NAME_SUFFIX].shortToken.address
        )

        const prices = await getWeiPricesFromPools(pools)

        expect(prices.longPoolPrice).eq(expectedLongPoolPrice)
        expect(prices.shortPoolPrice).eq(expectedShortPoolPrice)
      })
    })

    describe('# getStrategyToUse', () => {
      it('selects BUY_AND_REDEEM if L + S < (1 - spread)', () => {
        const longPoolPrice = parseEther('0.5')
        const shortPoolPrice = parseEther('1').sub(TEST_SPREAD).sub(longPoolPrice).sub(1)
        expect(longPoolPrice.add(shortPoolPrice)).lt(parseEther('1').sub(TEST_SPREAD))

        expect(getStrategyToUse(longPoolPrice, shortPoolPrice, TEST_SPREAD)).eq(
          ArbitrageStrategy.BUY_AND_REDEEM
        )
      })

      it('reports insufficient spread if L + S = (1 - spread)', () => {
        const longPoolPrice = parseEther('0.5')
        const shortPoolPrice = parseEther('1').sub(TEST_SPREAD).sub(longPoolPrice)
        expect(longPoolPrice.add(shortPoolPrice)).eq(parseEther('1').sub(TEST_SPREAD))

        expect(getStrategyToUse(longPoolPrice, shortPoolPrice, TEST_SPREAD)).eq(
          ArbitrageStrategy.INSUFFICIENT_SPREAD
        )
      })

      it('selects MINT_AND_SELL if L + S > (1 + spread)', () => {
        const longPoolPrice = parseEther('0.5')
        const shortPoolPrice = parseEther('1').add(TEST_SPREAD).sub(longPoolPrice).add(1)
        expect(longPoolPrice.add(shortPoolPrice)).gt(parseEther('1').add(TEST_SPREAD))

        expect(getStrategyToUse(longPoolPrice, shortPoolPrice, TEST_SPREAD)).eq(
          ArbitrageStrategy.MINT_AND_SELL
        )
      })

      it('reports insufficient spread if L + S = (1 + spread)', () => {
        const longPoolPrice = parseEther('0.5')
        const shortPoolPrice = parseEther('1').add(TEST_SPREAD).sub(longPoolPrice)
        expect(longPoolPrice.add(shortPoolPrice)).eq(parseEther('1').add(TEST_SPREAD))

        expect(getStrategyToUse(longPoolPrice, shortPoolPrice, TEST_SPREAD)).eq(
          ArbitrageStrategy.INSUFFICIENT_SPREAD
        )
      })

      it('reports insufficient spread if L + S exactly above (1 - spread)', () => {
        const longPoolPrice = parseEther('0.5')
        const shortPoolPrice = parseEther('1').sub(TEST_SPREAD).sub(longPoolPrice).add(1)
        expect(longPoolPrice.add(shortPoolPrice)).gt(parseEther('1').sub(TEST_SPREAD))
        expect(longPoolPrice.add(shortPoolPrice)).lt(parseEther('1').add(TEST_SPREAD))

        expect(getStrategyToUse(longPoolPrice, shortPoolPrice, TEST_SPREAD)).eq(
          ArbitrageStrategy.INSUFFICIENT_SPREAD
        )
      })

      it('reports insufficient spread if L + S exactly below (1 + spread)', () => {
        const longPoolPrice = parseEther('0.5')
        const shortPoolPrice = parseEther('1').add(TEST_SPREAD).sub(longPoolPrice).sub(1)
        expect(longPoolPrice.add(shortPoolPrice)).gt(parseEther('1').sub(TEST_SPREAD))
        expect(longPoolPrice.add(shortPoolPrice)).lt(parseEther('1').add(TEST_SPREAD))

        expect(getStrategyToUse(longPoolPrice, shortPoolPrice, TEST_SPREAD)).eq(
          ArbitrageStrategy.INSUFFICIENT_SPREAD
        )
      })
    })

    describe('# getEstimateGivenTradeSize', () => {
      let fakeArbitrageBroker: FakeContract<ArbitrageBroker>
      beforeEach(async () => {
        fakeArbitrageBroker = await fakeArbitrageBrokerFixture()
      })

      it('returns `buyAndRedeem()` estimate if BUY_AND_REDEEM selected', async () => {
        const expectedTradeSize = parseEther('1')
        const expectedProfit = parseEther('2')
        const expectedCollateralToBuyLong = parseEther('3')
        const expectedCollateralToBuyShort = parseEther('4')
        fakeArbitrageBroker.buyAndRedeem.returns({
          profit: expectedProfit,
          collateralToBuyLong: expectedCollateralToBuyLong,
          collateralToBuyShort: expectedCollateralToBuyShort,
        })

        const estimateReturnValues = await getEstimateGivenTradeSize(
          ArbitrageStrategy.BUY_AND_REDEEM,
          attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address),
          core.markets[TEST_NAME_SUFFIX].address,
          expectedTradeSize
        )

        // Verification must be done value by value because equality between structs is not supported
        expect(estimateReturnValues.tradeSize).eq(expectedTradeSize)
        expect(estimateReturnValues.profit).eq(expectedProfit)
        expect(estimateReturnValues.collateralToBuyLong).eq(expectedCollateralToBuyLong)
        expect(estimateReturnValues.collateralToBuyShort).eq(expectedCollateralToBuyShort)
        expect(typeof estimateReturnValues.collateralFromSellingLong).eq('undefined')
        expect(typeof estimateReturnValues.collateralFromSellingShort).eq('undefined')
      })

      it('returns `mintAndSell()` estimate if MINT_AND_SELL selected', async () => {
        // Reverse values to ensure we're not just returning the same thing
        const expectedTradeSize = parseEther('4')
        const expectedProfit = parseEther('3')
        const expectedCollateralFromSellingLong = parseEther('2')
        const expectedCollateralFromSellingShort = parseEther('1')
        fakeArbitrageBroker.mintAndSell.returns({
          profit: expectedProfit,
          collateralFromSellingLong: expectedCollateralFromSellingLong,
          collateralFromSellingShort: expectedCollateralFromSellingShort,
        })

        const estimateReturnValues = await getEstimateGivenTradeSize(
          ArbitrageStrategy.MINT_AND_SELL,
          attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address),
          core.markets[TEST_NAME_SUFFIX].address,
          expectedTradeSize
        )

        expect(estimateReturnValues.tradeSize).eq(expectedTradeSize)
        expect(estimateReturnValues.profit).eq(expectedProfit)
        expect(estimateReturnValues.collateralFromSellingLong).eq(expectedCollateralFromSellingLong)
        expect(estimateReturnValues.collateralFromSellingShort).eq(
          expectedCollateralFromSellingShort
        )
        expect(typeof estimateReturnValues.collateralToBuyLong).eq('undefined')
        expect(typeof estimateReturnValues.collateralToBuyShort).eq('undefined')
      })

      it('throw error if INSUFFICIENT_SPREAD selected', async () => {
        await expect(
          getEstimateGivenTradeSize(
            ArbitrageStrategy.INSUFFICIENT_SPREAD,
            attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address),
            core.markets[TEST_NAME_SUFFIX].address,
            parseEther('1')
          )
        ).rejectedWith('Cannot get estimate for INSUFFICIENT_SPREAD')
      })

      afterEach(() => {
        fakeArbitrageBroker.buyAndRedeem.reset()
        fakeArbitrageBroker.mintAndSell.reset()
      })
    })

    describe('# getSlippageFactor', () => {
      it('throws error if INSUFFICIENT_SPREAD selected', () => {
        expect(() => {
          getSlippageFactor(ArbitrageStrategy.INSUFFICIENT_SPREAD, '0.001')
        }).throws(Error, 'Cannot get estimate for INSUFFICIENT_SPREAD')
      })

      it('throws error if slippage < 0% and BUY_AND_REDEEM selected', () => {
        expect(() => {
          getSlippageFactor(ArbitrageStrategy.BUY_AND_REDEEM, '-0.001')
        }).throws(Error, 'Invalid slippage factor')
      })

      it('throws error if slippage < 0% and MINT_AND_SELL selected', () => {
        expect(() => {
          getSlippageFactor(ArbitrageStrategy.MINT_AND_SELL, '-0.001')
        }).throws(Error, 'Invalid slippage factor')
      })

      it('throws error if slippage > 100% and MINT_AND_SELL selected', () => {
        expect(() => {
          getSlippageFactor(ArbitrageStrategy.MINT_AND_SELL, '1.001')
        }).throws(Error, 'Invalid slippage factor')
      })

      it('returns 1 + slippage if BUY_AND_REDEEM selected', () => {
        expect(getSlippageFactor(ArbitrageStrategy.BUY_AND_REDEEM, '0.001')).eq(
          parseEther('1').add(parseEther('0.001'))
        )
      })

      it('returns 1 - slippage if MINT_AND_SELL selected', () => {
        expect(getSlippageFactor(ArbitrageStrategy.MINT_AND_SELL, '0.001')).eq(
          parseEther('1').sub(parseEther('0.001'))
        )
      })

      it('returns 1 + slippage if slippage > 100% and BUY_AND_REDEEM selected', () => {
        expect(getSlippageFactor(ArbitrageStrategy.BUY_AND_REDEEM, '1.001')).eq(
          parseEther('1').add(parseEther('1.001'))
        )
      })
    })

    describe('# getAdjustedEstimate', () => {
      const TEST_MAX_SLIPPAGE = '0.01' // 1%
      const TEST_GAS_COST_BUFFER = parseEther('0.5') // $0.5 (0.5 Collateral)

      it('returns estimate with adjusted cost if BUY_AND_REDEEM selected', () => {
        /**
         * Values chosen to represent profit = tradeSize - collateralToBuyLong
         * - collateralToBuyShort and to ensure values are all different.
         */
        const unadjustedEstimate = {
          tradeSize: parseEther('7'),
          profit: parseEther('4'),
          collateralToBuyLong: parseEther('2'),
          collateralToBuyShort: parseEther('1'),
        }

        const adjustedEstimate = getAdjustedEstimate(
          ArbitrageStrategy.BUY_AND_REDEEM,
          unadjustedEstimate,
          TEST_GAS_COST_BUFFER,
          TEST_MAX_SLIPPAGE
        )

        expect(adjustedEstimate.tradeSize).eq(unadjustedEstimate.tradeSize)
        expect(adjustedEstimate.profit).lt(unadjustedEstimate.profit)
        // Ensure adjusted cost to purchase is > than unadjusted cost
        expect(adjustedEstimate.collateralToBuyLong).gt(unadjustedEstimate.collateralToBuyLong)
        expect(adjustedEstimate.collateralToBuyShort).gt(unadjustedEstimate.collateralToBuyShort)
        expect(typeof adjustedEstimate.collateralFromSellingLong).eq('undefined')
        expect(typeof adjustedEstimate.collateralFromSellingShort).eq('undefined')
      })

      it('returns estimate with adjusted proceeds if MINT_AND_SELL selected', () => {
        /**
         * Values chosen to represent profit = collateralFromSellingLong + collateralFromSellingShort
         * - tradeSize and to ensure values are all different.
         */
        const unadjustedEstimate = {
          tradeSize: parseEther('5'),
          profit: parseEther('2'),
          collateralFromSellingLong: parseEther('4'),
          collateralFromSellingShort: parseEther('3'),
        }

        const adjustedEstimate = getAdjustedEstimate(
          ArbitrageStrategy.MINT_AND_SELL,
          unadjustedEstimate,
          TEST_GAS_COST_BUFFER,
          TEST_MAX_SLIPPAGE
        )

        expect(adjustedEstimate.tradeSize).eq(unadjustedEstimate.tradeSize)
        expect(adjustedEstimate.profit).lt(unadjustedEstimate.profit)
        // Ensure floor on proceeds from selling is < than unadjusted proceeds
        expect(adjustedEstimate.collateralFromSellingLong).lt(
          unadjustedEstimate.collateralFromSellingLong
        )
        expect(adjustedEstimate.collateralFromSellingShort).lt(
          unadjustedEstimate.collateralFromSellingShort
        )
        expect(typeof adjustedEstimate.collateralToBuyLong).eq('undefined')
        expect(typeof adjustedEstimate.collateralToBuyShort).eq('undefined')
      })

      it('throws error if INSUFFICIENT_SPREAD selected', () => {
        const unadjustedEstimate = {
          tradeSize: parseEther('5'),
          profit: parseEther('2'),
          collateralFromSellingLong: parseEther('4'),
          collateralFromSellingShort: parseEther('3'),
        }
        const testGasBuffer = parseEther('0.5') // $0.5

        expect(() => {
          getAdjustedEstimate(
            ArbitrageStrategy.INSUFFICIENT_SPREAD,
            unadjustedEstimate,
            testGasBuffer,
            TEST_MAX_SLIPPAGE
          )
        }).throws(Error, 'Cannot get estimate for INSUFFICIENT_SPREAD')
      })
    })

    describe('# getNextTradeSize', () => {
      it('reverts if growth factor = 0', () => {
        expect(() => {
          getNextTradeSize(parseEther('1'), '0')
        }).throws(Error, 'Invalid growth factor')
      })

      it('reverts if growth factor < 0', () => {
        expect(() => {
          getNextTradeSize(parseEther('1'), '-0.001')
        }).throws(Error, 'Invalid growth factor')
      })

      it('reverts if growth factor right below 1', () => {
        expect(() => {
          getNextTradeSize(parseEther('1'), '0.999')
        }).throws(Error, 'Invalid growth factor')
      })

      it('reverts if growth factor = 1', () => {
        expect(() => {
          getNextTradeSize(parseEther('1'), '1')
        }).throws(Error, 'Invalid growth factor')
      })

      it("doesn't revert if growth factor > 1", () => {
        getNextTradeSize(parseEther('1'), '1.0001')
      })
    })

    describe('# getIdealTradeSize', () => {
      let fakeArbitrageBroker: FakeContract<ArbitrageBroker>
      let mockGetEstimateGivenTradeSize: SinonStub
      let mockGetAdjustedEstimate: SinonStub
      let mockGetNextTradeSize: SinonStub
      const TEST_GAS_COST_BUFFER = parseEther('0.5') // $0.5
      const TEST_MAX_SLIPPAGE = '0.01' // 1%
      const TEST_GROWTH_FACTOR = '1.2' // 20%
      const TEST_MAX_TRADE_SIZE = parseEther('2')
      /**
       * Since the only value that really matters for testing this
       * function is the profit, I am storing the object here, and
       * then only the profit returned will be changed for each test.
       */
      const TEST_ESTIMATE = {
        tradeSize: parseEther('1'),
        profit: parseEther('2'),
        collateralToBuyLong: parseEther('3'),
        collateralToBuyShort: parseEther('4'),
      }
      before(() => {
        mockGetEstimateGivenTradeSize = stub(ArbitragePools, 'getEstimateGivenTradeSize')
        mockGetAdjustedEstimate = stub(ArbitragePools, 'getAdjustedEstimate')
        mockGetNextTradeSize = stub(ArbitragePools, 'getNextTradeSize')
      })

      beforeEach(async () => {
        fakeArbitrageBroker = await fakeArbitrageBrokerFixture()
      })

      it('returns 0 profit if immediately new profit < previous profit', async () => {
        mockGetAdjustedEstimate.returns({
          ...TEST_ESTIMATE,
          /**
           * Return a negative profit so that new profit is
           * immediately less than the starting profit of 0.
           *
           * Other parameters here are irrelevant to this
           * function's logic, they are just passed along.
           */
          profit: parseEther('-0.1'),
        })
        const initialTradeSize = parseEther('1')

        const estimate = await getIdealTradeSize(
          initialTradeSize,
          TEST_MAX_TRADE_SIZE,
          ArbitrageStrategy.BUY_AND_REDEEM,
          attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address),
          core.markets[TEST_NAME_SUFFIX].address,
          TEST_GAS_COST_BUFFER,
          TEST_MAX_SLIPPAGE,
          TEST_GROWTH_FACTOR
        )

        // Verify estimate values
        expect(estimate.tradeSize).eq(0)
        expect(estimate.profit).eq(0)
        expect(typeof estimate.collateralToBuyLong).eq('undefined')
        expect(typeof estimate.collateralToBuyShort).eq('undefined')
        expect(typeof estimate.collateralFromSellingLong).eq('undefined')
        expect(typeof estimate.collateralFromSellingShort).eq('undefined')
        // Verify function call counts
        expect(mockGetEstimateGivenTradeSize.callCount).eq(1)
        expect(mockGetAdjustedEstimate.callCount).eq(1)
        expect(mockGetNextTradeSize.callCount).eq(0)
      })

      it('returns 0 profit if initial trade size > max', async () => {
        mockGetAdjustedEstimate.returns(TEST_ESTIMATE)
        const initialTradeSize = TEST_MAX_TRADE_SIZE.add(1)

        const estimate = await getIdealTradeSize(
          /**
           * Pass in a trade size immediately exceeding
           * the max so that it exits with profit osf 0.
           */
          initialTradeSize,
          TEST_MAX_TRADE_SIZE,
          ArbitrageStrategy.BUY_AND_REDEEM,
          attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address),
          core.markets[TEST_NAME_SUFFIX].address,
          TEST_GAS_COST_BUFFER,
          TEST_MAX_SLIPPAGE,
          TEST_GROWTH_FACTOR
        )

        // Verify estimate values
        expect(estimate.tradeSize).eq(0)
        expect(estimate.profit).eq(0)
        expect(typeof estimate.collateralToBuyLong).eq('undefined')
        expect(typeof estimate.collateralToBuyShort).eq('undefined')
        expect(typeof estimate.collateralFromSellingLong).eq('undefined')
        expect(typeof estimate.collateralFromSellingShort).eq('undefined')
        // Verify function call counts
        expect(mockGetEstimateGivenTradeSize.callCount).eq(0)
        expect(mockGetAdjustedEstimate.callCount).eq(0)
        expect(mockGetNextTradeSize.callCount).eq(0)
      })

      it('returns last estimate if trade size > max after a size increase', async () => {
        mockGetAdjustedEstimate.returns(TEST_ESTIMATE)
        /**
         * Placing both the exact max and max + 1 allows us to concisely test
         * the comparison logic here.
         */
        mockGetNextTradeSize.onCall(0).returns(TEST_MAX_TRADE_SIZE)
        mockGetNextTradeSize.onCall(1).returns(TEST_MAX_TRADE_SIZE.add(1))
        mockGetAdjustedEstimate.onCall(0).returns(TEST_ESTIMATE)
        /**
         * Modify estimate to ensure the one returned is the one
         * prior to the trade size exceeding the max.
         */
        const expectedLastEstimate = {
          tradeSize: TEST_ESTIMATE.tradeSize.add(1),
          profit: TEST_ESTIMATE.profit.add(1),
          collateralToBuyLong: TEST_ESTIMATE.collateralToBuyLong.add(1),
          collateralToBuyShort: TEST_ESTIMATE.collateralToBuyShort.add(1),
        }
        mockGetAdjustedEstimate.onCall(1).returns(expectedLastEstimate)
        const initialTradeSize = parseEther('1')

        const estimate = await getIdealTradeSize(
          initialTradeSize,
          TEST_MAX_TRADE_SIZE,
          ArbitrageStrategy.BUY_AND_REDEEM,
          attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address),
          core.markets[TEST_NAME_SUFFIX].address,
          TEST_GAS_COST_BUFFER,
          TEST_MAX_SLIPPAGE,
          TEST_GROWTH_FACTOR
        )

        // Verify estimate values
        expect(estimate.tradeSize).eq(expectedLastEstimate.tradeSize)
        expect(estimate.profit).eq(expectedLastEstimate.profit)
        expect(estimate.collateralToBuyLong).eq(expectedLastEstimate.collateralToBuyLong)
        expect(estimate.collateralToBuyShort).eq(expectedLastEstimate.collateralToBuyShort)
        expect(typeof estimate.collateralFromSellingLong).eq('undefined')
        expect(typeof estimate.collateralFromSellingShort).eq('undefined')
        // Verify function call counts
        expect(mockGetEstimateGivenTradeSize.callCount).eq(2)
        expect(mockGetAdjustedEstimate.callCount).eq(2)
        expect(mockGetNextTradeSize.callCount).eq(2)
      })

      it('returns last estimate if new profit < previous profit after a profit increase', async () => {
        /**
         * Trigger calls with increasing profit and end with a final call
         * that returns a smaller profit. Expect that the estimate returned
         * was one obtained before profit decreased.
         */
        const initialProfit = parseEther('1')
        mockGetAdjustedEstimate.onCall(0).returns({
          ...TEST_ESTIMATE,
          profit: initialProfit,
        })
        let nextProfit = initialProfit.add(1)
        const expectedLastEstimate = {
          tradeSize: TEST_ESTIMATE.tradeSize.add(1),
          profit: nextProfit,
          collateralToBuyLong: TEST_ESTIMATE.collateralToBuyLong.add(1),
          collateralToBuyShort: TEST_ESTIMATE.collateralToBuyShort.add(1),
        }
        mockGetAdjustedEstimate.onCall(1).returns(expectedLastEstimate)
        // Decrease profit next call to cause it to exit
        nextProfit = nextProfit.sub(1)
        mockGetAdjustedEstimate.onCall(2).returns({
          ...expectedLastEstimate,
          profit: nextProfit,
        })
        const initialTradeSize = parseEther('1')
        /**
         * For simplicity, return the initial trade size, since we are verifying
         * exit on profit, rather than trade size.
         */
        mockGetNextTradeSize.returns(initialTradeSize)

        const estimate = await getIdealTradeSize(
          initialTradeSize,
          TEST_MAX_TRADE_SIZE,
          ArbitrageStrategy.BUY_AND_REDEEM,
          attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address),
          core.markets[TEST_NAME_SUFFIX].address,
          TEST_GAS_COST_BUFFER,
          TEST_MAX_SLIPPAGE,
          TEST_GROWTH_FACTOR
        )

        // Verify estimate values
        expect(estimate.tradeSize).eq(expectedLastEstimate.tradeSize)
        expect(estimate.profit).eq(expectedLastEstimate.profit)
        expect(estimate.collateralToBuyLong).eq(expectedLastEstimate.collateralToBuyLong)
        expect(estimate.collateralToBuyShort).eq(expectedLastEstimate.collateralToBuyShort)
        expect(typeof estimate.collateralFromSellingLong).eq('undefined')
        expect(typeof estimate.collateralFromSellingShort).eq('undefined')
        // Verify function call counts
        expect(mockGetEstimateGivenTradeSize.callCount).eq(3)
        expect(mockGetAdjustedEstimate.callCount).eq(3)
        expect(mockGetNextTradeSize.callCount).eq(2)
      })

      afterEach(() => {
        mockGetEstimateGivenTradeSize.reset()
        mockGetAdjustedEstimate.reset()
        mockGetNextTradeSize.reset()
      })
    })

    describe('# executeTrade', () => {
      let fakeArbitrageBroker: FakeContract<ArbitrageBroker>
      beforeEach(async () => {
        fakeArbitrageBroker = await fakeArbitrageBrokerFixture()
      })

      it("calls 'buyAndRedeem()' if BUY_AND_REDEEM selected", async () => {
        const testBuyAndRedeemEstimate = {
          tradeSize: parseEther('1'),
          profit: parseEther('2'),
          collateralToBuyLong: parseEther('3'),
          collateralToBuyShort: parseEther('4'),
        }

        await executeTrade(
          governance,
          ArbitrageStrategy.BUY_AND_REDEEM,
          // Wrap mock in a standalone ethers Contact object
          attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address),
          core.markets[TEST_NAME_SUFFIX].address,
          testBuyAndRedeemEstimate
        )

        const buyAndRedeemArgs = fakeArbitrageBroker.buyAndRedeem.atCall(0).callHistory[0].args
        expect(buyAndRedeemArgs.market).eq(core.markets[TEST_NAME_SUFFIX].address)
        expect(buyAndRedeemArgs.tradeParams.longShortAmount).eq(testBuyAndRedeemEstimate.tradeSize)
        expect(buyAndRedeemArgs.tradeParams.collateralLimitForLong).eq(
          testBuyAndRedeemEstimate.collateralToBuyLong
        )
        expect(buyAndRedeemArgs.tradeParams.collateralLimitForShort).eq(
          testBuyAndRedeemEstimate.collateralToBuyShort
        )
      })

      it("calls 'mintAndSell' if MINT_AND_SELL selected", async () => {
        const testMintAndSellEstimate = {
          tradeSize: parseEther('1'),
          profit: parseEther('2'),
          collateralFromSellingLong: parseEther('3'),
          collateralFromSellingShort: parseEther('4'),
        }

        await executeTrade(
          governance,
          ArbitrageStrategy.MINT_AND_SELL,
          // Wrap mock in a standalone ethers Contact object
          attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address),
          core.markets[TEST_NAME_SUFFIX].address,
          testMintAndSellEstimate
        )

        const mintAndSellArgs = fakeArbitrageBroker.mintAndSell.atCall(0).callHistory[0].args
        expect(mintAndSellArgs.market).eq(core.markets[TEST_NAME_SUFFIX].address)
        expect(mintAndSellArgs.tradeParams.longShortAmount).eq(testMintAndSellEstimate.tradeSize)
        expect(mintAndSellArgs.tradeParams.collateralLimitForLong).eq(
          testMintAndSellEstimate.collateralFromSellingLong
        )
        expect(mintAndSellArgs.tradeParams.collateralLimitForShort).eq(
          testMintAndSellEstimate.collateralFromSellingShort
        )
      })

      it('throws error if INSUFFICIENT_SPREAD selected', async () => {
        // Reuse BUY_AND_REDEEM estimate since it doesn't really matter for this test
        const testBuyAndRedeemEstimate = {
          tradeSize: parseEther('1'),
          profit: parseEther('2'),
          collateralToBuyLong: parseEther('3'),
          collateralToBuyShort: parseEther('4'),
        }

        await expect(
          executeTrade(
            governance,
            ArbitrageStrategy.INSUFFICIENT_SPREAD,
            // Wrap mock in a standalone ethers Contact object
            attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address),
            core.markets[TEST_NAME_SUFFIX].address,
            testBuyAndRedeemEstimate
          )
        ).rejectedWith('Cannot execute trade for INSUFFICIENT_SPREAD')
      })

      afterEach(() => {
        fakeArbitrageBroker.buyAndRedeem.reset()
        fakeArbitrageBroker.mintAndSell.reset()
      })
    })

    describe('# executeTradeIfProfitable', () => {
      let fakeArbitrageBroker: FakeContract<ArbitrageBroker>
      let mockExecuteTrade: SinonStub
      let mockSleep: SinonStub
      const TEST_MIN_PROFIT = parseEther('1')
      const TEST_DELAY = 5000
      before(() => {
        mockExecuteTrade = stub(ArbitragePools, 'executeTrade')
        mockExecuteTrade.returns()
        mockSleep = stub(ArbitragePools, 'sleep')
        mockSleep.returns()
      })

      beforeEach(async () => {
        fakeArbitrageBroker = await fakeArbitrageBrokerFixture()
      })

      it("calls 'executeTrade()' and sleep() if profit > min", async () => {
        const attachedBroker = attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address)
        const testEstimate = {
          tradeSize: parseEther('2'),
          profit: TEST_MIN_PROFIT.add(1),
          collateralToBuyLong: parseEther('3'),
          collateralToBuyShort: parseEther('4'),
        }

        await executeTradeIfProfitable(
          governance,
          ArbitrageStrategy.BUY_AND_REDEEM,
          attachedBroker,
          core.markets[TEST_NAME_SUFFIX].address,
          testEstimate,
          TEST_MIN_PROFIT,
          TEST_DELAY
        )

        expect(mockExecuteTrade.callCount).eq(1)
        expect(mockExecuteTrade.firstCall.args[0]).eq(governance)
        expect(mockExecuteTrade.firstCall.args[1]).eq(ArbitrageStrategy.BUY_AND_REDEEM)
        expect(mockExecuteTrade.firstCall.args[2]).eq(attachedBroker)
        expect(mockExecuteTrade.firstCall.args[3]).eq(core.markets[TEST_NAME_SUFFIX].address)
        expect(mockExecuteTrade.firstCall.args[4]).eq(testEstimate)
        expect(mockSleep.callCount).eq(1)
      })

      it("calls 'executeTrade()' and sleep() if profit = min", async () => {
        const attachedBroker = attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address)
        const testEstimate = {
          tradeSize: parseEther('2'),
          profit: TEST_MIN_PROFIT,
          collateralToBuyLong: parseEther('3'),
          collateralToBuyShort: parseEther('4'),
        }

        await executeTradeIfProfitable(
          governance,
          ArbitrageStrategy.BUY_AND_REDEEM,
          attachedBroker,
          core.markets[TEST_NAME_SUFFIX].address,
          testEstimate,
          TEST_MIN_PROFIT,
          TEST_DELAY
        )

        expect(mockExecuteTrade.callCount).eq(1)
        expect(mockExecuteTrade.firstCall.args[0]).eq(governance)
        expect(mockExecuteTrade.firstCall.args[1]).eq(ArbitrageStrategy.BUY_AND_REDEEM)
        expect(mockExecuteTrade.firstCall.args[2]).eq(attachedBroker)
        expect(mockExecuteTrade.firstCall.args[3]).eq(core.markets[TEST_NAME_SUFFIX].address)
        expect(mockExecuteTrade.firstCall.args[4]).eq(testEstimate)
        expect(mockSleep.callCount).eq(1)
      })

      it("doesn't call 'executeTrade()' if profit < min", async () => {
        const attachedBroker = attachArbitrageBroker(ethers.provider, fakeArbitrageBroker.address)
        const testEstimate = {
          tradeSize: parseEther('2'),
          profit: TEST_MIN_PROFIT.sub(1),
          collateralToBuyLong: parseEther('3'),
          collateralToBuyShort: parseEther('4'),
        }

        await executeTradeIfProfitable(
          governance,
          ArbitrageStrategy.BUY_AND_REDEEM,
          attachedBroker,
          core.markets[TEST_NAME_SUFFIX].address,
          testEstimate,
          TEST_MIN_PROFIT,
          TEST_DELAY
        )

        expect(mockExecuteTrade.callCount).eq(0)
        expect(mockSleep.callCount).eq(1)
        expect(mockSleep.firstCall.args[0]).eq(TEST_DELAY)
      })

      afterEach(() => {
        mockExecuteTrade.reset()
        mockSleep.reset()
      })
    })
  })
})
