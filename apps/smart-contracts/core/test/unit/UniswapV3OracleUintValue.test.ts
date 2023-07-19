import chai, { expect } from 'chai'
import { parseUnits } from 'ethers/lib/utils'
import { ethers, network } from 'hardhat'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { getPrePOAddressForNetwork } from 'prepo-constants'
import { snapshots } from 'prepo-hardhat'
import { uniswapV3OracleUintValueFixture } from '../fixtures/UintValueFixtures'
import { fakeUniswapV3OracleFixture } from '../fixtures/UniswapV3OracleFixture'
import { IUniswapV3Oracle, UniswapV3OracleUintValue } from '../../types/generated'

chai.use(smock.matchers)
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> UniswapV3OracleUintValue', () => {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let fakeUniswapV3Oracle: FakeContract<IUniswapV3Oracle>
  let uniswapV3OracleUintValue: UniswapV3OracleUintValue
  const BASE_TOKEN_DECIMALS = 6
  const QUOTE_TOKEN_DECIMALS = 18
  const USDC_ADDRESS = getPrePOAddressForNetwork('USDC', 'arbitrumOne')
  const WETH_ADDRESS = getPrePOAddressForNetwork('WETH', 'arbitrumOne')
  const TEST_OBSERVATION_PERIOD = 604800
  const TEST_BASE_AMOUNT = parseUnits('0.069', BASE_TOKEN_DECIMALS) // $0.069
  const TEST_QUOTE_AMOUNT = parseUnits('0.0000414', QUOTE_TOKEN_DECIMALS) // $0.069 * 0.0006 ETH per USDC

  snapshotter.setupSnapshotContext('UniswapV3OracleUintValue')
  before(async () => {
    ;[deployer, user] = await ethers.getSigners()
    fakeUniswapV3Oracle = await fakeUniswapV3OracleFixture()
    uniswapV3OracleUintValue = await uniswapV3OracleUintValueFixture(
      fakeUniswapV3Oracle.address,
      USDC_ADDRESS,
      WETH_ADDRESS
    )
    await snapshotter.saveSnapshot()
  })

  describe('initial state', () => {
    it('sets static oracle from constructor', async () => {
      expect(await uniswapV3OracleUintValue.getUniswapOracle()).eq(fakeUniswapV3Oracle.address)
    })

    it('sets base token from constructor', async () => {
      expect(await uniswapV3OracleUintValue.getUniswapBaseToken()).eq(USDC_ADDRESS)
    })

    it('sets quote token from constructor', async () => {
      expect(await uniswapV3OracleUintValue.getUniswapQuoteToken()).eq(WETH_ADDRESS)
    })
  })

  describe('# setObservationPeriod', () => {
    it('reverts if not owner', async () => {
      expect(await uniswapV3OracleUintValue.owner()).not.eq(user.address)

      await expect(
        uniswapV3OracleUintValue.connect(user).setObservationPeriod(TEST_OBSERVATION_PERIOD)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('sets to zero', async () => {
      await uniswapV3OracleUintValue.setObservationPeriod(TEST_OBSERVATION_PERIOD)
      expect(await uniswapV3OracleUintValue.getObservationPeriod()).not.eq(0)

      await uniswapV3OracleUintValue.connect(deployer).setObservationPeriod(0)

      expect(await uniswapV3OracleUintValue.getObservationPeriod()).eq(0)
    })

    it('sets to non-zero', async () => {
      expect(await uniswapV3OracleUintValue.getObservationPeriod()).not.eq(TEST_OBSERVATION_PERIOD)

      await uniswapV3OracleUintValue.connect(deployer).setObservationPeriod(TEST_OBSERVATION_PERIOD)

      expect(await uniswapV3OracleUintValue.getObservationPeriod()).eq(TEST_OBSERVATION_PERIOD)
    })

    it('is idempotent', async () => {
      expect(await uniswapV3OracleUintValue.getObservationPeriod()).not.eq(TEST_OBSERVATION_PERIOD)

      await uniswapV3OracleUintValue.connect(deployer).setObservationPeriod(TEST_OBSERVATION_PERIOD)

      expect(await uniswapV3OracleUintValue.getObservationPeriod()).eq(TEST_OBSERVATION_PERIOD)

      await uniswapV3OracleUintValue.connect(deployer).setObservationPeriod(TEST_OBSERVATION_PERIOD)

      expect(await uniswapV3OracleUintValue.getObservationPeriod()).eq(TEST_OBSERVATION_PERIOD)
    })

    it('emits ObservationPeriodChange', async () => {
      const tx = await uniswapV3OracleUintValue
        .connect(deployer)
        .setObservationPeriod(TEST_OBSERVATION_PERIOD)

      await expect(tx)
        .emit(uniswapV3OracleUintValue, 'ObservationPeriodChange')
        .withArgs(TEST_OBSERVATION_PERIOD)
    })
  })

  describe('# setBaseAmount', () => {
    it('reverts if not owner', async () => {
      expect(await uniswapV3OracleUintValue.owner()).not.eq(user.address)

      await expect(
        uniswapV3OracleUintValue.connect(user).setBaseAmount(TEST_BASE_AMOUNT)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('sets to zero', async () => {
      await uniswapV3OracleUintValue.setBaseAmount(TEST_BASE_AMOUNT)
      expect(await uniswapV3OracleUintValue.getBaseAmount()).not.eq(0)

      await uniswapV3OracleUintValue.connect(deployer).setBaseAmount(0)

      expect(await uniswapV3OracleUintValue.getBaseAmount()).eq(0)
    })

    it('sets to non-zero', async () => {
      expect(await uniswapV3OracleUintValue.getBaseAmount()).not.eq(TEST_BASE_AMOUNT)

      await uniswapV3OracleUintValue.connect(deployer).setBaseAmount(TEST_BASE_AMOUNT)

      expect(await uniswapV3OracleUintValue.getBaseAmount()).eq(TEST_BASE_AMOUNT)
    })

    it('is idempotent', async () => {
      expect(await uniswapV3OracleUintValue.getBaseAmount()).not.eq(TEST_BASE_AMOUNT)

      await uniswapV3OracleUintValue.connect(deployer).setBaseAmount(TEST_BASE_AMOUNT)

      expect(await uniswapV3OracleUintValue.getBaseAmount()).eq(TEST_BASE_AMOUNT)

      await uniswapV3OracleUintValue.connect(deployer).setBaseAmount(TEST_BASE_AMOUNT)

      expect(await uniswapV3OracleUintValue.getBaseAmount()).eq(TEST_BASE_AMOUNT)
    })

    it('emits BaseAmountChange', async () => {
      const tx = await uniswapV3OracleUintValue.connect(deployer).setBaseAmount(TEST_BASE_AMOUNT)

      await expect(tx).emit(uniswapV3OracleUintValue, 'BaseAmountChange').withArgs(TEST_BASE_AMOUNT)
    })
  })

  describe('# get', () => {
    snapshotter.setupSnapshotContext('StaticOracleUintValue-get')
    before(async () => {
      fakeUniswapV3Oracle.quoteAllAvailablePoolsWithTimePeriod
        .whenCalledWith(TEST_BASE_AMOUNT, USDC_ADDRESS, WETH_ADDRESS, TEST_OBSERVATION_PERIOD)
        .returns([TEST_QUOTE_AMOUNT, []])
      await uniswapV3OracleUintValue.setObservationPeriod(TEST_OBSERVATION_PERIOD)
      await uniswapV3OracleUintValue.setBaseAmount(TEST_BASE_AMOUNT)
      await snapshotter.saveSnapshot()
    })

    it("calls 'quoteAllAvailablePoolsWithTimePeriod' with correct parameters", async () => {
      await uniswapV3OracleUintValue.get()

      expect(fakeUniswapV3Oracle.quoteAllAvailablePoolsWithTimePeriod).calledWith(
        TEST_BASE_AMOUNT,
        USDC_ADDRESS,
        WETH_ADDRESS,
        TEST_OBSERVATION_PERIOD
      )
    })

    it('returns quoted amount', async () => {
      expect(await uniswapV3OracleUintValue.get()).eq(TEST_QUOTE_AMOUNT)
    })
  })
})
