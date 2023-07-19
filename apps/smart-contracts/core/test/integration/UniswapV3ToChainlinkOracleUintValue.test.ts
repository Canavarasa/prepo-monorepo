import chai, { expect } from 'chai'
import { parseUnits } from 'ethers/lib/utils'
import { ethers, network } from 'hardhat'
import { smock } from '@defi-wonderland/smock'
import { getPrePOAddressForNetwork } from 'prepo-constants'
import { snapshots } from 'prepo-hardhat'
import { attachAggregatorInterfaceFixture } from '../fixtures/ChainlinkFixture'
import {
  attachUniswapV3OracleUintValueFixture,
  uniswapV3ToChainlinkOracleUintValueFixture,
} from '../fixtures/UintValueFixtures'
import { attachUniswapV3OracleFixture } from '../fixtures/UniswapV3OracleFixture'
import {
  AggregatorInterface,
  IUniswapV3Oracle,
  UniswapV3OracleUintValue,
  UniswapV3ToChainlinkOracleUintValue,
} from '../../types/generated'

chai.use(smock.matchers)
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> UniswapV3ToChainlinkOracleUintValue', () => {
  let uniswapV3Oracle: IUniswapV3Oracle
  let chainlinkOracle: AggregatorInterface
  let uniswapV3ToChainlinkOracleUintValue: UniswapV3ToChainlinkOracleUintValue
  const BASE_TOKEN_DECIMALS = 6
  const CHAINLINK_NON_ETH_DECIMALS = 8
  const USDC_ADDRESS = getPrePOAddressForNetwork('USDC', 'arbitrumOne')
  const WETH_ADDRESS = getPrePOAddressForNetwork('WETH', 'arbitrumOne')
  const WSTETH_ADDRESS = getPrePOAddressForNetwork('WSTETH', 'arbitrumOne')
  const WSTETH_ETH_CHAINLINK_ORACLE = '0xb523AE262D20A936BC152e6023996e46FDC2A95D'
  const ETH_USDC_CHAINLINK_ORACLE = '0x639fe6ab55c921f74e7fac1ee960c0b6293ba612'
  const TEST_OBSERVATION_PERIOD = 604800 // 7 days
  const TEST_BASE_AMOUNT = parseUnits('0.2', BASE_TOKEN_DECIMALS) // $0.20

  snapshotter.setupSnapshotContext('UniswapV3ToChainlinkOracleUintValue')
  before(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
            blockNumber: 99400000,
          },
        },
      ],
    })
    await snapshotter.saveSnapshot()
  })

  describe('initial state', () => {
    snapshotter.setupSnapshotContext('UniswapV3ToChainlinkOracleUintValue')
    before(async () => {
      uniswapV3Oracle = await attachUniswapV3OracleFixture(
        ethers,
        getPrePOAddressForNetwork('UNIV3_ORACLE', 'arbitrumOne')
      )
      // ETH (Chainlink Quote Token) = ETH (Uniswap Quote Token) and both are 18 decimal
      chainlinkOracle = await attachAggregatorInterfaceFixture(ethers, WSTETH_ETH_CHAINLINK_ORACLE)
      uniswapV3ToChainlinkOracleUintValue = await uniswapV3ToChainlinkOracleUintValueFixture(
        uniswapV3Oracle.address,
        USDC_ADDRESS,
        WETH_ADDRESS,
        chainlinkOracle.address,
        WSTETH_ADDRESS,
        WETH_ADDRESS,
        18,
        18
      )
      await uniswapV3ToChainlinkOracleUintValue.setObservationPeriod(TEST_OBSERVATION_PERIOD)
      await uniswapV3ToChainlinkOracleUintValue.setBaseAmount(TEST_BASE_AMOUNT)
      await snapshotter.saveSnapshot()
    })

    it('sets Uniswap oracle from constructor', async () => {
      expect(await uniswapV3ToChainlinkOracleUintValue.getUniswapOracle()).eq(
        uniswapV3Oracle.address
      )
    })

    it('sets base token from constructor', async () => {
      expect(await uniswapV3ToChainlinkOracleUintValue.getUniswapBaseToken()).eq(USDC_ADDRESS)
    })

    it('sets quote token from constructor', async () => {
      expect(await uniswapV3ToChainlinkOracleUintValue.getUniswapQuoteToken()).eq(WETH_ADDRESS)
    })

    it('sets Chainlink oracle from constructor', async () => {
      expect(await uniswapV3ToChainlinkOracleUintValue.getChainlinkOracle()).eq(
        chainlinkOracle.address
      )
    })
  })

  describe('# getFinalQuoteToken', () => {
    snapshotter.setupSnapshotContext('UniswapV3ToChainlinkOracleUintValue-getFinalQuoteToken')
    before(async () => {
      uniswapV3Oracle = await attachUniswapV3OracleFixture(
        ethers,
        getPrePOAddressForNetwork('UNIV3_ORACLE', 'arbitrumOne')
      )
      await snapshotter.saveSnapshot()
    })

    it('returns the chainlink base token if same quote tokens', async () => {
      chainlinkOracle = await attachAggregatorInterfaceFixture(ethers, WSTETH_ETH_CHAINLINK_ORACLE)
      uniswapV3ToChainlinkOracleUintValue = await uniswapV3ToChainlinkOracleUintValueFixture(
        uniswapV3Oracle.address,
        USDC_ADDRESS,
        WETH_ADDRESS,
        chainlinkOracle.address,
        WSTETH_ADDRESS,
        WETH_ADDRESS,
        18,
        18
      )

      expect(await uniswapV3ToChainlinkOracleUintValue.getFinalQuoteToken()).eq(WSTETH_ADDRESS)
    })

    it('returns the chainlink quote token if different quote tokens', async () => {
      chainlinkOracle = await attachAggregatorInterfaceFixture(ethers, ETH_USDC_CHAINLINK_ORACLE)
      uniswapV3ToChainlinkOracleUintValue = await uniswapV3ToChainlinkOracleUintValueFixture(
        uniswapV3Oracle.address,
        USDC_ADDRESS,
        WETH_ADDRESS,
        chainlinkOracle.address,
        WETH_ADDRESS,
        USDC_ADDRESS,
        18,
        CHAINLINK_NON_ETH_DECIMALS
      )

      expect(await uniswapV3ToChainlinkOracleUintValue.getFinalQuoteToken()).eq(USDC_ADDRESS)
    })
  })

  describe('# get - same quote token and same token decimals', () => {
    let uniswapV3OracleUintValue: UniswapV3OracleUintValue
    snapshotter.setupSnapshotContext('UniswapV3ToChainlinkOracleUintValue-get')
    before(async () => {
      uniswapV3Oracle = await attachUniswapV3OracleFixture(
        ethers,
        getPrePOAddressForNetwork('UNIV3_ORACLE', 'arbitrumOne')
      )
      chainlinkOracle = await attachAggregatorInterfaceFixture(ethers, WSTETH_ETH_CHAINLINK_ORACLE)
      uniswapV3ToChainlinkOracleUintValue = await uniswapV3ToChainlinkOracleUintValueFixture(
        uniswapV3Oracle.address,
        USDC_ADDRESS,
        WETH_ADDRESS,
        chainlinkOracle.address,
        WSTETH_ADDRESS,
        WETH_ADDRESS,
        18,
        18
      )
      uniswapV3OracleUintValue = await attachUniswapV3OracleUintValueFixture(
        '0x0fBBfd902a379b50E869f279758463Fc26Ac02ad'
      )
      await uniswapV3ToChainlinkOracleUintValue.setObservationPeriod(TEST_OBSERVATION_PERIOD)
      await uniswapV3ToChainlinkOracleUintValue.setBaseAmount(TEST_BASE_AMOUNT)
      await snapshotter.saveSnapshot()
    })

    it('returns wstETH amount < ETH denominated Uniswap quote', async () => {
      expect(await uniswapV3ToChainlinkOracleUintValue.get()).lt(
        await uniswapV3OracleUintValue.get()
      )
    })
  })

  describe('# get - different quote token and different token decimals', () => {
    snapshotter.setupSnapshotContext('UniswapV3ToChainlinkOracleUintValue-get')
    before(async () => {
      uniswapV3Oracle = await attachUniswapV3OracleFixture(
        ethers,
        getPrePOAddressForNetwork('UNIV3_ORACLE', 'arbitrumOne')
      )
      /**
       * USD (Chainlink Quote Asset) != ETH (Uniswap Quote Token) and Chainlink uses
       * 8 decimals instead of WETH's 18. Note that this is not USDC, Chainlink's USD
       * denominated feeds all use 8 decimals.
       */
      chainlinkOracle = await attachAggregatorInterfaceFixture(ethers, ETH_USDC_CHAINLINK_ORACLE)
      uniswapV3ToChainlinkOracleUintValue = await uniswapV3ToChainlinkOracleUintValueFixture(
        uniswapV3Oracle.address,
        USDC_ADDRESS,
        WETH_ADDRESS,
        chainlinkOracle.address,
        WETH_ADDRESS,
        USDC_ADDRESS,
        18,
        CHAINLINK_NON_ETH_DECIMALS
      )
      await uniswapV3ToChainlinkOracleUintValue.setObservationPeriod(TEST_OBSERVATION_PERIOD)
      await uniswapV3ToChainlinkOracleUintValue.setBaseAmount(TEST_BASE_AMOUNT)
      await snapshotter.saveSnapshot()
    })

    it('returns initial USD amount', async () => {
      expect(await uniswapV3ToChainlinkOracleUintValue.get()).within(
        parseUnits('0.2', CHAINLINK_NON_ETH_DECIMALS).mul(95).div(100),
        parseUnits('0.2', CHAINLINK_NON_ETH_DECIMALS).mul(105).div(100)
      )
    })
  })
})
