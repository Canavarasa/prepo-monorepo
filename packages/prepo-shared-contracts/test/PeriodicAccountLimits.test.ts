import { expect } from 'chai'
import { parseEther } from 'ethers/lib/utils'
import { ethers, network } from 'hardhat'
import { snapshots, utils } from 'prepo-hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { periodicAccountLimitsTestFixture } from './fixtures/PeriodicAccountLimitsFixture'
import { PeriodicAccountLimitsTest } from '../types/generated'

describe('=> PeriodicAccountLimits', () => {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let periodicAccountLimits: PeriodicAccountLimitsTest
  const { Snapshotter } = snapshots
  const snapshotter = new Snapshotter(ethers, network)
  const TEST_PERIOD = 86400 // 1 day
  const TEST_LIMIT = parseEther('1')

  const { getLastTimestamp, setNextTimestamp, mineBlock } = utils

  snapshotter.setupSnapshotContext('PeriodicAccountLimits')
  before(async () => {
    ;[deployer, user] = await ethers.getSigners()
    periodicAccountLimits = await periodicAccountLimitsTestFixture()
    await snapshotter.saveSnapshot()
  })

  describe('initial state', () => {
    it("doesn't set period length", async () => {
      expect(await periodicAccountLimits.getAccountLimitResetPeriod()).eq(0)
    })

    it("doesn't set account limit", async () => {
      expect(await periodicAccountLimits.getAccountLimitPerPeriod()).eq(0)
    })
  })

  describe('# setAccountLimitResetPeriod', () => {
    it('sets period length to non-zero', async () => {
      expect(await periodicAccountLimits.getAccountLimitResetPeriod()).eq(0)

      await periodicAccountLimits.setAccountLimitResetPeriod(TEST_PERIOD)

      expect(await periodicAccountLimits.getAccountLimitResetPeriod()).not.eq(0)
      expect(await periodicAccountLimits.getAccountLimitResetPeriod()).eq(TEST_PERIOD)
    })

    it('sets period length to 0', async () => {
      await periodicAccountLimits.setAccountLimitResetPeriod(TEST_PERIOD)
      expect(await periodicAccountLimits.getAccountLimitResetPeriod()).not.eq(0)

      await periodicAccountLimits.setAccountLimitResetPeriod(0)

      expect(await periodicAccountLimits.getAccountLimitResetPeriod()).eq(0)
    })

    it('is idempotent', async () => {
      expect(await periodicAccountLimits.getAccountLimitResetPeriod()).eq(0)

      await periodicAccountLimits.setAccountLimitResetPeriod(TEST_PERIOD)

      expect(await periodicAccountLimits.getAccountLimitResetPeriod()).eq(TEST_PERIOD)

      await periodicAccountLimits.setAccountLimitResetPeriod(TEST_PERIOD)

      expect(await periodicAccountLimits.getAccountLimitResetPeriod()).eq(TEST_PERIOD)
    })

    it('emits AccountLimitResetPeriodChange', async () => {
      await expect(periodicAccountLimits.setAccountLimitResetPeriod(TEST_PERIOD))
        .to.emit(periodicAccountLimits, 'AccountLimitResetPeriodChange')
        .withArgs(TEST_PERIOD)
    })
  })

  describe('# setAccountLimitPerPeriod', () => {
    it('sets limit to non-zero', async () => {
      expect(await periodicAccountLimits.getAccountLimitPerPeriod()).eq(0)

      await periodicAccountLimits.setAccountLimitPerPeriod(TEST_LIMIT)

      expect(await periodicAccountLimits.getAccountLimitPerPeriod()).not.eq(0)
      expect(await periodicAccountLimits.getAccountLimitPerPeriod()).eq(TEST_LIMIT)
    })

    it('sets limit to 0', async () => {
      await periodicAccountLimits.setAccountLimitPerPeriod(TEST_LIMIT)
      expect(await periodicAccountLimits.getAccountLimitPerPeriod()).not.eq(0)

      await periodicAccountLimits.setAccountLimitPerPeriod(0)

      expect(await periodicAccountLimits.getAccountLimitPerPeriod()).eq(0)
    })

    it('is idempotent', async () => {
      expect(await periodicAccountLimits.getAccountLimitPerPeriod()).eq(0)

      await periodicAccountLimits.setAccountLimitPerPeriod(TEST_LIMIT)

      expect(await periodicAccountLimits.getAccountLimitPerPeriod()).eq(TEST_LIMIT)

      await periodicAccountLimits.setAccountLimitPerPeriod(TEST_LIMIT)

      expect(await periodicAccountLimits.getAccountLimitPerPeriod()).eq(TEST_LIMIT)
    })

    it('emits AccountLimitPerPeriodChange', async () => {
      await expect(periodicAccountLimits.setAccountLimitPerPeriod(TEST_LIMIT))
        .to.emit(periodicAccountLimits, 'AccountLimitPerPeriodChange')
        .withArgs(TEST_LIMIT)
    })
  })

  describe('# exceedsAccountLimit', () => {
    snapshotter.setupSnapshotContext('PeriodicAccountLimits-exceedsAccountLimit')
    before(async () => {
      await periodicAccountLimits.setAccountLimitResetPeriod(TEST_PERIOD)
      await periodicAccountLimits.setAccountLimitPerPeriod(TEST_LIMIT)
    })

    it('returns true if amount > limit and account is new', async () => {
      expect(await periodicAccountLimits.getLastPeriodReset(user.address)).eq(0)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, TEST_LIMIT.add(1))).eq(
        true
      )
    })

    it('returns true if amount > limit and period passed', async () => {
      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await mineBlock(ethers.provider, prevLastPeriodReset.toNumber() + TEST_PERIOD + 1)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, TEST_LIMIT.add(1))).eq(
        true
      )
    })

    it('returns true if total > limit and period ongoing', async () => {
      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, 1)).eq(true)
    })

    it('returns true if total > limit and period exactly reached', async () => {
      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await mineBlock(ethers.provider, prevLastPeriodReset.toNumber() + TEST_PERIOD)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, 1)).eq(true)
    })

    it('returns true if total > limit after limit was decreased', async () => {
      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT.sub(1))
      await periodicAccountLimits.connect(deployer).setAccountLimitPerPeriod(TEST_LIMIT.sub(1))

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, 1)).eq(true)
    })

    it('returns false if total = limit and period ongoing', async () => {
      await periodicAccountLimits.addAmount(user.address, 1)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, TEST_LIMIT.sub(1))).eq(
        false
      )
    })

    it('returns false if total < limit and period ongoing', async () => {
      await periodicAccountLimits.addAmount(user.address, 1)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, TEST_LIMIT.sub(2))).eq(
        false
      )
    })

    it('returns false if total = limit and period exactly reached', async () => {
      await periodicAccountLimits.addAmount(user.address, 1)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await mineBlock(ethers.provider, prevLastPeriodReset.toNumber() + TEST_PERIOD)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, TEST_LIMIT.sub(1))).eq(
        false
      )
    })

    it('returns false if total < limit and period exactly reached', async () => {
      await periodicAccountLimits.addAmount(user.address, 1)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await mineBlock(ethers.provider, prevLastPeriodReset.toNumber() + TEST_PERIOD)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, TEST_LIMIT.sub(2))).eq(
        false
      )
    })

    it('returns false if total > limit but period passed', async () => {
      await periodicAccountLimits.addAmount(user.address, 1)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await mineBlock(ethers.provider, prevLastPeriodReset.toNumber() + TEST_PERIOD + 1)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, TEST_LIMIT)).eq(false)
    })

    it('returns false if total < limit and period passed', async () => {
      await periodicAccountLimits.addAmount(user.address, 1)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await mineBlock(ethers.provider, prevLastPeriodReset.toNumber() + TEST_PERIOD + 1)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, TEST_LIMIT.sub(1))).eq(
        false
      )
    })

    it('returns false if total < limit after limit was increased', async () => {
      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)
      await periodicAccountLimits.connect(deployer).setAccountLimitPerPeriod(TEST_LIMIT.add(1))

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, 1)).eq(false)
    })

    it('evaluates total based on new period if period shortened', async () => {
      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await mineBlock(ethers.provider, prevLastPeriodReset.toNumber() + 15)
      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, 1)).eq(true)
      // Set the period to the time of the last tx
      await periodicAccountLimits.connect(deployer).setAccountLimitResetPeriod(15)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, 1)).eq(false)
    })

    it('evaluates total based on new period if period lengthened', async () => {
      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await mineBlock(ethers.provider, prevLastPeriodReset.toNumber() + TEST_PERIOD)
      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, 1)).eq(true)
      /**
       * Set by 15 rather than 1 since a block will be mined when lengthening the period, and the
       * timestamp might be advanced by > 1 second.
       */
      await periodicAccountLimits.connect(deployer).setAccountLimitResetPeriod(TEST_PERIOD + 15)

      expect(await periodicAccountLimits.exceedsAccountLimit(user.address, 1)).eq(true)
    })
  })

  describe('# addAmount', () => {
    snapshotter.setupSnapshotContext('PeriodicAccountLimits-addAmount')
    before(async () => {
      await periodicAccountLimits.setAccountLimitResetPeriod(TEST_PERIOD)
      await periodicAccountLimits.setAccountLimitPerPeriod(TEST_LIMIT)
    })

    it('sets last account reset to now if account is new', async () => {
      expect(await periodicAccountLimits.getLastPeriodReset(user.address)).eq(0)

      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)

      expect(await periodicAccountLimits.getLastPeriodReset(user.address)).eq(
        await getLastTimestamp(ethers.provider)
      )
    })

    it('sets last account reset to now if period passed', async () => {
      await periodicAccountLimits.addAmount(user.address, 1)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await setNextTimestamp(ethers.provider, prevLastPeriodReset.toNumber() + TEST_PERIOD + 1)

      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)

      expect(await periodicAccountLimits.getLastPeriodReset(user.address)).not.eq(
        prevLastPeriodReset
      )
      expect(await periodicAccountLimits.getLastPeriodReset(user.address)).eq(
        await getLastTimestamp(ethers.provider)
      )
    })

    it("doesn't update last account reset if period exactly reached", async () => {
      await periodicAccountLimits.addAmount(user.address, 1)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await setNextTimestamp(ethers.provider, prevLastPeriodReset.toNumber() + TEST_PERIOD)

      await periodicAccountLimits.addAmount(user.address, 1)

      expect(await periodicAccountLimits.getLastPeriodReset(user.address)).eq(prevLastPeriodReset)
    })

    it("doesn't update last account reset if period ongoing", async () => {
      await periodicAccountLimits.addAmount(user.address, 1)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)

      await periodicAccountLimits.addAmount(user.address, 1)

      expect(await periodicAccountLimits.getLastPeriodReset(user.address)).eq(prevLastPeriodReset)
    })

    it('resets total based on new period if period shortened', async () => {
      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await setNextTimestamp(ethers.provider, prevLastPeriodReset.toNumber() + 15)
      await periodicAccountLimits.addAmount(user.address, 1)
      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(TEST_LIMIT.add(1))
      // Set the period to the time of the last tx
      await periodicAccountLimits.connect(deployer).setAccountLimitResetPeriod(15)

      await periodicAccountLimits.addAmount(user.address, 1)

      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(1)
    })

    it('resets total based on new period if period lengthened', async () => {
      await periodicAccountLimits.addAmount(user.address, 1)
      const prevLastPeriodReset = await periodicAccountLimits.getLastPeriodReset(user.address)
      await periodicAccountLimits.setAccountLimitResetPeriod(TEST_PERIOD + 1)
      await setNextTimestamp(ethers.provider, prevLastPeriodReset.toNumber() + TEST_PERIOD + 1)

      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT.sub(1))

      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(TEST_LIMIT)

      await periodicAccountLimits.addAmount(user.address, 1)

      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(1)
    })

    it('adds amount if > limit', async () => {
      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(0)

      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT.add(1))

      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(TEST_LIMIT.add(1))
    })

    it('adds amount if = limit', async () => {
      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(0)

      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)

      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(TEST_LIMIT)
    })

    it('adds amount if < limit', async () => {
      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(0)

      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT.sub(1))

      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(TEST_LIMIT.sub(1))
    })

    it('adds different successive amounts', async () => {
      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(0)

      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT)

      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(TEST_LIMIT)

      await periodicAccountLimits.addAmount(user.address, TEST_LIMIT.sub(1))

      expect(await periodicAccountLimits.getAmountThisPeriod(user.address)).eq(
        TEST_LIMIT.add(TEST_LIMIT.sub(1))
      )
    })
  })
})
