/* eslint-disable no-await-in-loop */
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ZERO_ADDRESS } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { vestingFixture, mockVestingClaimerFixture } from './fixtures/VestingFixtures'
import { mockERC20Fixture } from './fixtures/MockERC20Fixtures'
import { ZERO, ONE } from '../utils'
import { Vesting, MockERC20, MockVestingClaimer } from '../types/generated'

const { mineBlocks, mineBlock } = utils

describe('Vesting', () => {
  let deployer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let vesting: Vesting
  let testStartTime: number
  let testEndTime: number
  let currentTime: number
  let mockERC20Token: MockERC20
  let mockVestingClaimer: MockVestingClaimer
  let recipients: string[]
  let amountsAllocated: BigNumber[]
  let lowerAllocationAmounts: BigNumber[]
  let higherAllocationAmounts: BigNumber[]
  let timeAfterVestingStarted: number
  const DAY_IN_SECONDS = 86400
  const YEAR_IN_SECONDS = DAY_IN_SECONDS * 365
  const ONE_ETH = parseEther('1')
  const BLOCK_DURATION_IN_SECONDS = 15

  const deployVesting = async (): Promise<void> => {
    ;[deployer, user1, user2] = await ethers.getSigners()
    const mockERC20Recipient = deployer.address
    const mockERC20Decimal = 18
    const mockERC20InitialMint = ONE_ETH.mul(100)
    mockERC20Token = await mockERC20Fixture(
      'Mock ERC20',
      'MERC20',
      mockERC20Decimal,
      mockERC20Recipient,
      mockERC20InitialMint
    )
    testStartTime = (await utils.getLastTimestamp(ethers.provider)) + DAY_IN_SECONDS
    testEndTime = testStartTime + 3 * YEAR_IN_SECONDS
    vesting = await vestingFixture(mockERC20Token.address, testStartTime, testEndTime)
  }

  describe('initial state', () => {
    before(async () => {
      await deployVesting()
    })

    it('reverts if start time > end time', async () => {
      await expect(vestingFixture(mockERC20Token.address, 2, 1)).reverted
    })

    it('reverts if start time = end time', async () => {
      await expect(vestingFixture(mockERC20Token.address, 1, 1)).reverted
    })

    it('sets nominee to zero address', async () => {
      expect(await vesting.getNominee()).eq(ZERO_ADDRESS)
    })

    it('sets owner to deployer', async () => {
      expect(await vesting.owner()).eq(deployer.address)
    })

    it('sets token from constructor', async () => {
      expect(await vesting.getToken()).eq(mockERC20Token.address)
    })

    it('sets start time from constructor', async () => {
      expect(await vesting.getVestingStartTime()).eq(testStartTime)
    })

    it('sets end time from constructor', async () => {
      expect(await vesting.getVestingEndTime()).eq(testEndTime)
    })
  })

  describe('# setAllocations', () => {
    let expectedDecrease: BigNumber
    before(() => {
      amountsAllocated = [ONE_ETH, ONE_ETH.mul(2)]
      lowerAllocationAmounts = [amountsAllocated[0].sub(1), amountsAllocated[1].sub(1)]
      higherAllocationAmounts = [amountsAllocated[0].add(1), amountsAllocated[1].add(1)]
      expectedDecrease = ONE.mul(2)
    })

    beforeEach(async () => {
      recipients = [user1.address, user2.address]
      await deployVesting()
      timeAfterVestingStarted = testStartTime + BLOCK_DURATION_IN_SECONDS
    })

    it('reverts if not owner', async () => {
      expect(await vesting.owner()).not.eq(user1.address)

      await expect(
        vesting.connect(user1).setAllocations(recipients, amountsAllocated)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if array length mismatch', async () => {
      expect([user1.address].length).not.eq(amountsAllocated.length)

      await expect(vesting.setAllocations([user1.address], amountsAllocated)).revertedWith(
        'Array length mismatch'
      )
    })

    it('allocates to single recipient', async () => {
      expect(await vesting.getAmountAllocated(user1.address)).not.eq(amountsAllocated[0])

      await vesting.setAllocations([user1.address], [amountsAllocated[0]])

      expect(await vesting.getAmountAllocated(user1.address)).eq(amountsAllocated[0])
    })

    it('allocates to multiple recipients', async () => {
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).not.eq(amountsAllocated[i])
      }

      await vesting.setAllocations(recipients, amountsAllocated)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).eq(amountsAllocated[i])
      }
    })

    it('allocates lower amounts to existing recipients', async () => {
      await vesting.setAllocations(recipients, amountsAllocated)
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).eq(amountsAllocated[i])
      }

      await vesting.setAllocations(recipients, lowerAllocationAmounts)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).eq(lowerAllocationAmounts[i])
        expect(lowerAllocationAmounts[i]).lt(amountsAllocated[i])
      }
    })

    it('allocates higher amounts to existing recipients', async () => {
      await vesting.setAllocations(recipients, amountsAllocated)
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).eq(amountsAllocated[i])
      }

      await vesting.setAllocations(recipients, higherAllocationAmounts)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).eq(higherAllocationAmounts[i])
        expect(higherAllocationAmounts[i]).gt(amountsAllocated[i])
      }
    })

    it('sets allocations to zero', async () => {
      await vesting.setAllocations(recipients, amountsAllocated)
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).not.eq(0)
      }
      const zeroAllocations = new Array(amountsAllocated.length).fill(ZERO)

      await vesting.setAllocations(recipients, zeroAllocations)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).eq(0)
      }
    })

    it('increases total allocated supply if allocating new recipients', async () => {
      const totalAllocationBefore = await vesting.getTotalAllocatedSupply()
      let expectedIncrease = ZERO
      for (let i = 0; i < amountsAllocated.length; i++) {
        expectedIncrease = expectedIncrease.add(amountsAllocated[i])
      }

      await vesting.setAllocations(recipients, amountsAllocated)

      const totalAllocationAfter = await vesting.getTotalAllocatedSupply()
      expect(totalAllocationAfter).eq(totalAllocationBefore.add(expectedIncrease))
      expect(totalAllocationAfter).not.eq(totalAllocationBefore)
    })

    it('increases total allocated supply if allocating higher amounts to existing recipients', async () => {
      await vesting.setAllocations(recipients, amountsAllocated)
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).eq(amountsAllocated[i])
      }
      const totalAllocationBefore = await vesting.getTotalAllocatedSupply()
      let expectedIncrease = ZERO
      for (let i = 0; i < amountsAllocated.length; i++) {
        expectedIncrease = expectedIncrease.add(higherAllocationAmounts[i].sub(amountsAllocated[i]))
      }

      await vesting.setAllocations(recipients, higherAllocationAmounts)

      const totalAllocationAfter = await vesting.getTotalAllocatedSupply()
      expect(totalAllocationAfter).eq(totalAllocationBefore.add(expectedIncrease))
      expect(totalAllocationAfter).not.eq(totalAllocationBefore)
    })

    it('decreases total allocated supply if allocating lower amounts to existing recipients', async () => {
      await vesting.setAllocations(recipients, amountsAllocated)
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).eq(amountsAllocated[i])
      }
      const totalAllocationBefore = await vesting.getTotalAllocatedSupply()

      await vesting.setAllocations(recipients, lowerAllocationAmounts)

      const totalAllocationAfter = await vesting.getTotalAllocatedSupply()
      expect(totalAllocationAfter).eq(totalAllocationBefore.sub(expectedDecrease))
      expect(totalAllocationAfter).not.eq(totalAllocationBefore)
    })

    it('is idempotent', async () => {
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).not.eq(amountsAllocated[i])
      }

      await vesting.setAllocations(recipients, amountsAllocated)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).eq(amountsAllocated[i])
      }

      await vesting.setAllocations(recipients, amountsAllocated)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).eq(amountsAllocated[i])
      }
    })

    it('emits Allocation events', async () => {
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).not.eq(amountsAllocated[i])
      }

      const tx = await vesting.setAllocations(recipients, amountsAllocated)

      for (let i = 0; i < recipients.length; i++) {
        await expect(tx)
          .emit(vesting, 'Allocation(address,uint256)')
          .withArgs(recipients[i], amountsAllocated[i])
      }
    })

    it('allocates lower amount than total claimed', async () => {
      // Setup for setting allocation and claiming.
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      // Set time to be after vesting start to be able to claim.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
      const lowerAllocationAmount = totalClaimedAfter.sub(1)

      await vesting.setAllocations([user1.address], [lowerAllocationAmount])

      expect(await vesting.getAmountAllocated(user1.address)).eq(lowerAllocationAmount)
    })

    it('allocates equal amount to total claimed', async () => {
      // Setup for setting allocation and claiming.
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      // Set time to be after vesting start to be able to claim.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const equalAllocationAmount = await vesting.getClaimedAmount(user1.address)

      await vesting.setAllocations([user1.address], [equalAllocationAmount])

      expect(await vesting.getAmountAllocated(user1.address)).eq(equalAllocationAmount)
    })

    it('allocates higher amount than total claimed', async () => {
      // Setup for setting allocation and claiming.
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      // Set time to be after vesting start to be able to claim.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const higherAllocationAmount = (await vesting.getClaimedAmount(user1.address)).add(1)

      await vesting.setAllocations([user1.address], [higherAllocationAmount])

      expect(await vesting.getAmountAllocated(user1.address)).eq(higherAllocationAmount)
    })
  })

  describe('# claim', () => {
    beforeEach(async () => {
      await deployVesting()
      mockVestingClaimer = await mockVestingClaimerFixture(vesting.address)
      currentTime = await utils.getLastTimestamp(ethers.provider)
      timeAfterVestingStarted = testStartTime + BLOCK_DURATION_IN_SECONDS
      recipients = [user1.address, user2.address, mockVestingClaimer.address]
      amountsAllocated = [ONE_ETH, ONE_ETH.mul(2), ONE_ETH.mul(3)]
      await vesting.setAllocations(recipients, amountsAllocated)
    })

    it('reverts if paused', async () => {
      await vesting.setPaused(true)
      expect(await vesting.isPaused()).eq(true)

      await expect(vesting.connect(user1).claim()).revertedWithCustomError(vesting, 'Paused')
    })

    it('reverts if unallocated user', async () => {
      expect(await vesting.getAmountAllocated(deployer.address)).eq(0)

      await expect(vesting.connect(deployer).claim()).revertedWith('Claimable amount = 0')
    })

    it('reverts if vesting not started', async () => {
      expect(currentTime).lt(testStartTime)
      expect(await vesting.connect(user1).getClaimableAmount(user1.address)).eq(0)

      await expect(vesting.connect(user1).claim()).revertedWith('Claimable amount = 0')
    })

    it('reverts if allocated amount < already claimed', async () => {
      /**
       * Special cases when allocation for a user is readjusted after it has
       * already been claimed, such that claimed amount >= allocated amount
       * In such case claimable amount will be zero.
       */
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      // Set current time to be after vesting started.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).eq(timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // Adjust allocations such that new allocated amount < claimed amount.
      const newAllocation = claimedAmount.sub(1)
      await vesting.setAllocations([user1.address], [newAllocation])
      expect(await vesting.getVestedAmount(user1.address)).lt(claimedAmount)

      await expect(vesting.connect(user1).claim()).revertedWith('Claimable amount = 0')
    })

    it('reverts if allocated amount = already claimed', async () => {
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      // Set current time to be after vesting started.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).eq(timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // Adjust allocations such that new allocated amount = claimed amount.
      const newAllocation = claimedAmount
      await vesting.setAllocations([user1.address], [newAllocation])
      expect(await vesting.getVestedAmount(user1.address)).lt(claimedAmount)

      await expect(vesting.connect(user1).claim()).revertedWith('Claimable amount = 0')
    })

    it('reverts if vested amount < already claimed', async () => {
      /**
       * Special case when allocation for a user is readjusted after it has
       * already been claimed, such that vested amount >= allocated amount
       * In such case claimable amount will be zero.
       */
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      // Set the current time to be after vesting started and then claim.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).eq(timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // adjust allocations such that new vested amount < claimed amount < newAllocation.
      const newAllocation = amountsAllocated[0].div(2)
      await vesting.setAllocations([user1.address], [newAllocation])
      expect(await vesting.getVestedAmount(user1.address)).lt(claimedAmount)

      await expect(vesting.connect(user1).claim()).revertedWith('Claimable amount = 0')
    })

    it('reverts if insufficient balance in contract', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).eq(timeAfterVestingStarted)
      const claimableAmount = await vesting.getClaimableAmount(user1.address)
      await mockERC20Token.transfer(vesting.address, claimableAmount.sub(1))

      await expect(vesting.connect(user1).claim()).revertedWith('Insufficient balance in contract')
    })

    it('transfers tokens if still vesting', async () => {
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).eq(timeAfterVestingStarted)
      const totalClaimedBefore = await vesting.getClaimedAmount(user1.address)
      const userBalanceBefore = await mockERC20Token.balanceOf(user1.address)
      const contractBalanceBefore = await mockERC20Token.balanceOf(vesting.address)

      await vesting.connect(user1).claim()

      const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
      const expectedChangeInBalance = totalClaimedAfter.sub(totalClaimedBefore)
      expect(await mockERC20Token.balanceOf(user1.address)).eq(
        userBalanceBefore.add(expectedChangeInBalance)
      )
      expect(await mockERC20Token.balanceOf(vesting.address)).eq(
        contractBalanceBefore.sub(expectedChangeInBalance)
      )
    })

    it('transfers tokens if vesting ended', async () => {
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, testEndTime + 1)
      expect(await utils.getLastTimestamp(ethers.provider)).eq(testEndTime + 1)
      const totalClaimedBefore = await vesting.getClaimedAmount(user1.address)
      const userBalanceBefore = await mockERC20Token.balanceOf(user1.address)
      const contractBalanceBefore = await mockERC20Token.balanceOf(vesting.address)

      await vesting.connect(user1).claim()

      const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
      const expectedChangeInBalance = totalClaimedAfter.sub(totalClaimedBefore)
      expect(await mockERC20Token.balanceOf(user1.address)).eq(
        userBalanceBefore.add(expectedChangeInBalance)
      )
      expect(await mockERC20Token.balanceOf(vesting.address)).eq(
        contractBalanceBefore.sub(expectedChangeInBalance)
      )
    })

    it('transfers only once if vesting ended', async () => {
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, testEndTime + 1)
      expect(await utils.getLastTimestamp(ethers.provider)).eq(testEndTime + 1)
      const totalClaimedBefore = await vesting.getClaimedAmount(user1.address)
      const userBalanceBefore = await mockERC20Token.balanceOf(user1.address)
      const contractBalanceBefore = await mockERC20Token.balanceOf(vesting.address)
      await vesting.connect(user1).claim()
      const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
      const expectedChangeInBalance = totalClaimedAfter.sub(totalClaimedBefore)
      expect(await mockERC20Token.balanceOf(user1.address)).eq(
        userBalanceBefore.add(expectedChangeInBalance)
      )
      expect(await mockERC20Token.balanceOf(vesting.address)).eq(
        contractBalanceBefore.sub(expectedChangeInBalance)
      )

      await expect(vesting.connect(user1).claim()).revertedWith('Claimable amount = 0')
    })

    it('transfers multiple times if still vesting', async () => {
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      const numberOfWithdrawals = 2
      const duration = testEndTime - testStartTime
      const timeBetweenEachWithdrawal = duration / numberOfWithdrawals
      for (let i = 1; i <= numberOfWithdrawals; i++) {
        const withdrawalTime = testStartTime + i * timeBetweenEachWithdrawal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await mineBlock(ethers.provider as any, withdrawalTime)
        expect(await utils.getLastTimestamp(ethers.provider)).eq(withdrawalTime)
        const totalClaimedBefore = await vesting.getClaimedAmount(user1.address)
        const userBalanceBefore = await mockERC20Token.balanceOf(user1.address)
        const contractBalanceBefore = await mockERC20Token.balanceOf(vesting.address)

        await vesting.connect(user1).claim()

        const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
        const expectedChangeInBalance = totalClaimedAfter.sub(totalClaimedBefore)
        expect(await mockERC20Token.balanceOf(user1.address)).eq(
          userBalanceBefore.add(expectedChangeInBalance)
        )
        expect(await mockERC20Token.balanceOf(vesting.address)).eq(
          contractBalanceBefore.sub(expectedChangeInBalance)
        )
      }
    })

    it('transfers to calling contract', async () => {
      await mockERC20Token.transfer(vesting.address, amountsAllocated[2])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).eq(timeAfterVestingStarted)
      const totalClaimedBefore = await vesting.getClaimedAmount(mockVestingClaimer.address)
      const mockVestingClaimerBalanceBefore = await mockERC20Token.balanceOf(
        mockVestingClaimer.address
      )
      const contractBalanceBefore = await mockERC20Token.balanceOf(vesting.address)

      await mockVestingClaimer.claimFunds()

      const totalClaimedAfter = await vesting.getClaimedAmount(mockVestingClaimer.address)
      const expectedChangeInBalance = totalClaimedAfter.sub(totalClaimedBefore)
      expect(await mockERC20Token.balanceOf(mockVestingClaimer.address)).eq(
        mockVestingClaimerBalanceBefore.add(expectedChangeInBalance)
      )
      expect(await mockERC20Token.balanceOf(vesting.address)).eq(
        contractBalanceBefore.sub(expectedChangeInBalance)
      )
    })

    it('emits Claim', async () => {
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).eq(timeAfterVestingStarted)
      const totalClaimedBefore = await vesting.getClaimedAmount(user1.address)

      const tx = await vesting.connect(user1).claim()

      const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
      const claimedAmount = totalClaimedAfter.sub(totalClaimedBefore)
      await expect(tx)
        .emit(vesting, 'Claim(address,uint256)')
        .withArgs(user1.address, claimedAmount)
    })
  })

  describe('# getClaimableAmount', () => {
    before(() => {
      amountsAllocated = [parseEther('1'), parseEther('2')]
      lowerAllocationAmounts = [amountsAllocated[0].sub(1), amountsAllocated[1].sub(1)]
      higherAllocationAmounts = [amountsAllocated[0].add(1), amountsAllocated[1].add(1)]
    })

    beforeEach(async () => {
      recipients = [user1.address, user2.address]
      await deployVesting()
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
    })

    it('returns 0 if unallocated user', async () => {
      expect(await vesting.getAmountAllocated(deployer.address)).eq(0)

      expect(await vesting.getClaimableAmount(deployer.address)).eq(0)
    })

    it('returns 0 if vesting not started', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime - 1)
      await vesting.setAllocations(recipients, amountsAllocated)
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)
      expect(await vesting.getClaimedAmount(user1.address)).eq(0)
      expect(await utils.getLastTimestamp(ethers.provider)).lt(await vesting.getVestingStartTime())

      expect(await vesting.getClaimableAmount(user1.address)).eq(0)
    })

    it('returns 0 if amount claimed > allocated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // Adjust allocations such that new allocated amount < claimed amount.
      const newAllocation = claimedAmount.sub(1)
      await vesting.setAllocations([user1.address], [newAllocation])
      expect(claimedAmount).gt(await vesting.getAmountAllocated(user1.address))

      expect(await vesting.getClaimableAmount(user1.address)).eq(0)
    })

    it('returns 0 if amount claimed = allocated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      await vesting.setAllocations([user1.address], [claimedAmount])
      expect(claimedAmount).eq(await vesting.getAmountAllocated(user1.address))

      expect(await vesting.getClaimableAmount(user1.address)).eq(0)
    })

    it('returns 0 if account claimed after vesting ended', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testEndTime + 1)
      await vesting.connect(user1).claim()

      expect(await vesting.getClaimableAmount(user1.address)).eq(0)
    })

    it('returns vested amount if still vesting and account never claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)

      expect(await vesting.getClaimableAmount(user1.address)).eq(
        await vesting.getVestedAmount(user1.address)
      )
    })

    it('returns entire allocation if vesting ended and account never claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testEndTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)

      expect(await vesting.getClaimableAmount(user1.address)).eq(
        await vesting.getAmountAllocated(user1.address)
      )
    })

    it('returns vested minus claimed amount if still vesting and account claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlocks(ethers.provider as any, 1)
      const vestedAmountTillNow = await vesting.getVestedAmount(user1.address)
      const expectedClaimableAmount = vestedAmountTillNow.sub(claimedAmount)

      expect(await vesting.getClaimableAmount(user1.address)).eq(expectedClaimableAmount)
    })

    it('returns allocation minus claimed amount if vesting ended after account claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, testEndTime + 1)
      const amountAllocated = await vesting.getAmountAllocated(user1.address)
      const expectedClaimableAmount = amountAllocated.sub(claimedAmount)

      expect(await vesting.getClaimableAmount(user1.address)).eq(expectedClaimableAmount)
    })
  })

  describe('# getVestedAmount', () => {
    before(() => {
      amountsAllocated = [parseEther('1'), parseEther('2')]
      lowerAllocationAmounts = [amountsAllocated[0].sub(1), amountsAllocated[1].sub(1)]
      higherAllocationAmounts = [amountsAllocated[0].add(1), amountsAllocated[1].add(1)]
    })

    beforeEach(async () => {
      recipients = [user1.address, user2.address]
      await deployVesting()
      timeAfterVestingStarted = testStartTime + BLOCK_DURATION_IN_SECONDS
      await mockERC20Token.transfer(vesting.address, amountsAllocated[0])
    })

    it('returns 0 if unallocated user', async () => {
      expect(await vesting.getAmountAllocated(deployer.address)).eq(0)

      expect(await vesting.getVestedAmount(deployer.address)).eq(0)
    })

    it('returns 0 if vesting not started', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime - 1)
      await vesting.setAllocations(recipients, amountsAllocated)
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)

      expect(await vesting.getVestedAmount(user1.address)).eq(0)
    })

    it('returns vesting amount if still vesting and account never claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)
      const vestedAmountTillNow = await vesting.getVestedAmount(user1.address)

      expect(await vesting.getVestedAmount(user1.address)).eq(vestedAmountTillNow)
    })

    it('returns entire allocation if vesting ended and account never claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testEndTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)

      expect(await vesting.getVestedAmount(user1.address)).eq(
        await vesting.getAmountAllocated(user1.address)
      )
    })

    it('returns vesting amount if still vesting and account claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)
      await vesting.connect(user1).claim()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlocks(ethers.provider as any, 1)
      const vestedAmountTillNow = await vesting.getVestedAmount(user1.address)

      expect(await vesting.getVestedAmount(user1.address)).eq(vestedAmountTillNow)
    })

    it('returns entire allocation if vesting ended after account claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testStartTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)
      await vesting.connect(user1).claim()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, testEndTime + 1)
      const amountAllocated = await vesting.getAmountAllocated(user1.address)

      expect(await vesting.getVestedAmount(user1.address)).eq(amountAllocated)
    })

    it('returns entire allocation if account claimed after vesting ended', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, testEndTime + 1)
      await vesting.setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).gt(0)
      await vesting.connect(user1).claim()
      const amountAllocated = await vesting.getAmountAllocated(user1.address)

      expect(await vesting.getVestedAmount(user1.address)).eq(amountAllocated)
    })
  })

  describe('# setPaused', () => {
    beforeEach(async () => {
      await deployVesting()
    })

    it("doesn't revert if owner", async () => {
      expect(await vesting.owner()).eq(deployer.address)

      await vesting.connect(deployer).setPaused(true)
    })

    it('reverts if not owner', async () => {
      expect(await vesting.owner()).not.eq(user1.address)

      await expect(vesting.connect(user1).setPaused(true)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('# withdrawERC20 (amounts)', () => {
    // Adding minimal test to just ensure function reverts and is callable.
    beforeEach(async () => {
      await deployVesting()
    })

    it("doesn't revert if owner", async () => {
      expect(await vesting.owner()).eq(deployer.address)

      await vesting
        .connect(deployer)
        ['withdrawERC20(address[],uint256[])']([mockERC20Token.address], [0])
    })

    it('reverts if not owner', async () => {
      expect(await vesting.owner()).not.eq(user1.address)

      await expect(
        vesting.connect(user1)['withdrawERC20(address[],uint256[])']([mockERC20Token.address], [0])
      ).revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('# withdrawERC20 (full balance)', () => {
    // Adding minimal test to just ensure function reverts and is callable.
    beforeEach(async () => {
      await deployVesting()
    })

    it("doesn't revert if owner", async () => {
      expect(await vesting.owner()).eq(deployer.address)

      await vesting.connect(deployer)['withdrawERC20(address[])']([mockERC20Token.address])
    })

    it('reverts if not owner', async () => {
      expect(await vesting.owner()).not.eq(user1.address)

      await expect(
        vesting.connect(user1)['withdrawERC20(address[])']([mockERC20Token.address])
      ).revertedWith('Ownable: caller is not the owner')
    })
  })
})
