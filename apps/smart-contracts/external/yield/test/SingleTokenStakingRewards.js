'use strict'

const { artifacts, contract } = require('hardhat')
const { toBN } = require('web3-utils')

const { assert } = require('./utils/common')

const { fastForward, toUnit, currentTime, setNextTimestamp } = require('./utils')()

const {
  onlyGivenAddressCanInvoke,
  encodeCall,
  getLeftoverRewards,
  getExpectedRewardForDuration,
  getNearestLowerMultiple,
  getNearestGreaterMultiple,
  getRewardsBalance,
  getRewardsEarned,
} = require('./utils/helpers')

contract('SingleTokenStakingRewards', (accounts) => {
  const [owner, initialCreator, mockRewardsDistributionAddress] = accounts
  let rewardsToken, stakingToken, StakingRewardsImplementation, StakingRewardsDeployed

  let initializeData
  let ProxyStakingRewardsDeployed

  const WEEK = 604800
  const DAY = 86400

  /**
   * toUnit is web3-utils version of parseEther, 100 is the default amount
   * staked in the Thales test suite.
   */
  const initialAmountToStake = toUnit(100)

  beforeEach(async () => {
    let Thales = artifacts.require('Thales')
    let StakingRewards = artifacts.require('SingleTokenStakingRewards')
    let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')

    rewardsToken = await Thales.new({ from: owner })
    stakingToken = rewardsToken

    ProxyStakingRewardsDeployed = await OwnedUpgradeabilityProxy.new({ from: initialCreator })
    StakingRewardsImplementation = await StakingRewards.new({ from: owner })
    console.log('ProxyStakingRewards', ProxyStakingRewardsDeployed.address)
    console.log('StakingRewardsImplementation', StakingRewardsImplementation.address)

    StakingRewardsDeployed = await StakingRewards.at(ProxyStakingRewardsDeployed.address)

    initializeData = encodeCall(
      'initialize',
      ['address', 'address', 'uint256'],
      [owner, rewardsToken.address, DAY * 7]
    )
    await ProxyStakingRewardsDeployed.upgradeToAndCall(
      StakingRewardsImplementation.address,
      initializeData,
      {
        from: initialCreator,
      }
    )

    await stakingToken.transfer(mockRewardsDistributionAddress, initialAmountToStake, {
      from: owner,
    })
  })

  describe('Constructor & Settings', () => {
    it('sets rewards token on constructor', async () => {
      assert.equal(await StakingRewardsDeployed.rewardsToken(), rewardsToken.address)
    })

    it('sets staking token to rewards token', async () => {
      assert.equal(
        await StakingRewardsDeployed.rewardsToken(),
        await StakingRewardsDeployed.stakingToken()
      )
    })

    it('sets owner on constructor', async () => {
      const ownerAddress = await StakingRewardsDeployed.owner()
      assert.equal(ownerAddress, owner)
    })
  })

  describe('Function permissions', () => {
    const rewardValue = toUnit(1.0)

    before(async () => {
      await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, { from: owner })
    })

    it('only owner can call notifyRewardAmount', async () => {
      let REVERT = 'Only the contract owner may perform this action'
      await assert.revert(
        StakingRewardsDeployed.notifyRewardAmount(rewardValue, {
          from: mockRewardsDistributionAddress,
        }),
        REVERT
      )
    })

    it('only owner address can call setRewardsDuration', async () => {
      await fastForward(DAY * 7)
      let REVERT = 'Only the contract owner may perform this action'
      await assert.revert(
        StakingRewardsDeployed.setRewardsDuration(70, { from: mockRewardsDistributionAddress }),
        REVERT
      )
    })
  })

  describe('lastTimeRewardApplicable()', () => {
    it('should return 0', async () => {
      assert.equal((await StakingRewardsDeployed.lastTimeRewardApplicable()).toString(), 0)
    })

    describe('when updated', () => {
      it('should equal current timestamp', async () => {
        const rewardValue = toUnit(5000.0)
        await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, { from: owner })

        await StakingRewardsDeployed.notifyRewardAmount(toUnit(1.0), {
          from: owner,
        })

        const cur = await currentTime()
        const lastTimeReward = await StakingRewardsDeployed.lastTimeRewardApplicable()

        assert.equal(cur.toString(), lastTimeReward.toString())
      })
    })
  })

  describe('rewardPerToken()', () => {
    it('should return 0', async () => {
      let reward = await StakingRewardsDeployed.rewardPerToken()
      assert.equal(reward, 0)
    })

    it('should return > 0', async () => {
      let totalSupply = await StakingRewardsDeployed.totalSupply()
      assert.equal(totalSupply.toString(), 0)

      await stakingToken.approve(StakingRewardsDeployed.address, toUnit(100), {
        from: mockRewardsDistributionAddress,
      })
      await StakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress })

      totalSupply = await StakingRewardsDeployed.totalSupply()
      assert.equal(totalSupply.toString(), toUnit(100))

      const rewardValue = toUnit(5000)
      await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, { from: owner })
      await StakingRewardsDeployed.notifyRewardAmount(toUnit(10), {
        from: owner,
      })

      await fastForward(DAY)

      const reward = await StakingRewardsDeployed.rewardPerToken()

      assert.ok(reward > 0)

      await fastForward(DAY)

      const newReward = await StakingRewardsDeployed.rewardPerToken()

      assert.ok(newReward > reward)
    })
  })

  describe('stake()', () => {
    it('increases staking balance', async () => {
      const initialStakeBal = await StakingRewardsDeployed.balanceOf(mockRewardsDistributionAddress)
      assert.equal(initialStakeBal, 0)

      await stakingToken.approve(StakingRewardsDeployed.address, toUnit(100), {
        from: mockRewardsDistributionAddress,
      })
      await StakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress })

      const postStakeBal = await StakingRewardsDeployed.balanceOf(mockRewardsDistributionAddress)

      assert.equal(postStakeBal.toString(), toUnit(100).toString())
    })
  })

  describe('earned()', () => {
    it('should be 0 when not staking', async () => {
      let earned = await StakingRewardsDeployed.earned(mockRewardsDistributionAddress)
      assert.equal(earned, 0)
    })

    it('should be > 0 when staking', async () => {
      await stakingToken.approve(StakingRewardsDeployed.address, toUnit(100), {
        from: mockRewardsDistributionAddress,
      })
      await StakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress })

      const rewardValue = toUnit(5000)
      await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, { from: owner })
      await StakingRewardsDeployed.notifyRewardAmount(toUnit(10), {
        from: owner,
      })

      await fastForward(DAY)

      const earned = await StakingRewardsDeployed.earned(mockRewardsDistributionAddress)

      assert.ok(earned > 0)
    })

    it('rewardRate should increase if new rewards come before DURATION ends', async () => {
      const totalToDistribute = toUnit('5000')

      await rewardsToken.transfer(StakingRewardsDeployed.address, totalToDistribute, {
        from: owner,
      })
      await StakingRewardsDeployed.notifyRewardAmount(toUnit(10), {
        from: owner,
      })

      const rewardRateInitial = await StakingRewardsDeployed.rewardRate()

      await rewardsToken.transfer(StakingRewardsDeployed.address, totalToDistribute, {
        from: owner,
      })

      await StakingRewardsDeployed.notifyRewardAmount(toUnit(10), {
        from: owner,
      })

      const rewardRateLater = await StakingRewardsDeployed.rewardRate()

      assert.ok(rewardRateInitial > 0)
      assert.ok(rewardRateLater > rewardRateInitial)
    })
  })

  describe('getReward()', () => {
    it('should increase rewards token balance', async () => {
      const totalToDistribute = toUnit('5000')

      await stakingToken.approve(StakingRewardsDeployed.address, toUnit(100), {
        from: mockRewardsDistributionAddress,
      })
      await StakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress })

      await rewardsToken.transfer(StakingRewardsDeployed.address, totalToDistribute, {
        from: owner,
      })
      await StakingRewardsDeployed.notifyRewardAmount(toUnit(10), {
        from: owner,
      })

      await fastForward(DAY)

      const initialRewardBal = await rewardsToken.balanceOf(mockRewardsDistributionAddress)
      const initialEarnedBal = await StakingRewardsDeployed.earned(mockRewardsDistributionAddress)

      await StakingRewardsDeployed.getReward({ from: mockRewardsDistributionAddress })

      const postRewardBal = await rewardsToken.balanceOf(mockRewardsDistributionAddress)
      const postEarnedBal = await StakingRewardsDeployed.earned(mockRewardsDistributionAddress)

      assert.ok(postEarnedBal < initialEarnedBal)
      assert.ok(postRewardBal > initialRewardBal)
    })
  })

  describe('compound()', () => {
    let timeToClaimRewards
    const rewardValue = toUnit(1000)
    beforeEach(async () => {
      await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, {
        from: owner,
      })
      await StakingRewardsDeployed.notifyRewardAmount(rewardValue, {
        from: owner,
      })
      await rewardsToken.approve(StakingRewardsDeployed.address, initialAmountToStake, {
        from: mockRewardsDistributionAddress,
      })
    })

    it('reverts if unstaked balance = 0 and unclaimed = 0', async () => {
      /**
       * Since we need the user's unstaked balance to be zero, and thales test suite
       * sends the user tokens before all tests, its easiest to just fast forward
       * a week and then stake the initial amount. By staking after the period, there
       * will be no rewards to claim and no unstaked balance.
       */
      await fastForward(WEEK)
      await StakingRewardsDeployed.stake(initialAmountToStake, {
        from: mockRewardsDistributionAddress,
      })
      assert.bnEqual(await rewardsToken.balanceOf(mockRewardsDistributionAddress), toBN(0))
      // estimate reward amount and ensure it is = 0
      timeToClaimRewards = (await currentTime()) + 10
      const userEarnedRewards = await getRewardsEarned(
        StakingRewardsDeployed,
        mockRewardsDistributionAddress,
        timeToClaimRewards
      )
      assert.bnEqual(userEarnedRewards, toBN(0))
      await setNextTimestamp(timeToClaimRewards)

      await assert.revert(
        StakingRewardsDeployed.compound({ from: mockRewardsDistributionAddress }),
        'Cannot stake 0'
      )
    })

    it('reverts if unstaked balance > 0 and unclaimed = 0 but insufficient approval', async () => {
      const userTokenBalanceBefore = await rewardsToken.balanceOf(mockRewardsDistributionAddress)
      assert.bnGt(userTokenBalanceBefore, toBN(0))
      // estimate reward amount and ensure it is = 0
      timeToClaimRewards = (await currentTime()) + 10
      const userEarnedRewards = await getRewardsEarned(
        StakingRewardsDeployed,
        mockRewardsDistributionAddress,
        timeToClaimRewards
      )
      assert.bnEqual(userEarnedRewards, toBN(0))
      await rewardsToken.approve(StakingRewardsDeployed.address, 0, {
        from: mockRewardsDistributionAddress,
      })
      await setNextTimestamp(timeToClaimRewards)

      await assert.revert(
        StakingRewardsDeployed.compound({ from: mockRewardsDistributionAddress }),
        'SafeERC20: low-level call failed'
      )
    })

    it('reverts if unstaked balance = 0 and unclaimed > 0 but insufficient approval', async () => {
      // stake tokens to get rewards and ensure unstaked balance is 0
      await StakingRewardsDeployed.stake(initialAmountToStake, {
        from: mockRewardsDistributionAddress,
      })
      assert.bnEqual(await rewardsToken.balanceOf(mockRewardsDistributionAddress), toBN(0))
      // estimate reward amount and ensure it is > 0
      timeToClaimRewards = (await currentTime()) + 10
      const userEarnedRewards = await getRewardsEarned(
        StakingRewardsDeployed,
        mockRewardsDistributionAddress,
        timeToClaimRewards
      )
      assert.bnGt(userEarnedRewards, toBN(0))
      assert.bnEqual(
        await rewardsToken.allowance(
          mockRewardsDistributionAddress,
          StakingRewardsDeployed.address
        ),
        toBN(0)
      )
      await setNextTimestamp(timeToClaimRewards)

      await assert.revert(
        StakingRewardsDeployed.compound({ from: mockRewardsDistributionAddress }),
        'SafeERC20: low-level call failed'
      )
    })

    it('reverts if unstaked balance > 0 and unclaimed > 0 but insufficient approval', async () => {
      // stake tokens to get rewards and ensure unstaked balance is 0
      await StakingRewardsDeployed.stake(initialAmountToStake, {
        from: mockRewardsDistributionAddress,
      })
      assert.bnEqual(await rewardsToken.balanceOf(mockRewardsDistributionAddress), toBN(0))
      // estimate reward amount and ensure it is > 0
      timeToClaimRewards = (await currentTime()) + 10
      const userEarnedRewards = await getRewardsEarned(
        StakingRewardsDeployed,
        mockRewardsDistributionAddress,
        timeToClaimRewards
      )
      assert.bnGt(userEarnedRewards, toBN(0))
      // Send additional tokens to the user for compound to stake
      const secondAmountToStake = initialAmountToStake.add(toUnit(1))
      await rewardsToken.transfer(mockRewardsDistributionAddress, secondAmountToStake, {
        from: owner,
      })
      const userTokenBalanceBefore = await rewardsToken.balanceOf(mockRewardsDistributionAddress)
      assert.bnLt(
        await rewardsToken.allowance(
          mockRewardsDistributionAddress,
          StakingRewardsDeployed.address
        ),
        userTokenBalanceBefore.add(userEarnedRewards)
      )
      await setNextTimestamp(timeToClaimRewards)

      await assert.revert(
        StakingRewardsDeployed.compound({ from: mockRewardsDistributionAddress }),
        'SafeERC20: low-level call failed'
      )
    })

    it('stakes balance if unstaked balance > 0 and unclaimed = 0', async () => {
      /**
       * Since this testcase is for when there are no unclaimed rewards,
       * we do not initially stake for the user to simplify the test.
       *
       * The approval in the beforeEach hook meant for an initial stake
       * position is used for the compound call.
       */
      const userTokenBalanceBefore = await rewardsToken.balanceOf(mockRewardsDistributionAddress)
      assert.bnGt(userTokenBalanceBefore, toBN(0))
      // estimate reward amount and ensure it is = 0
      timeToClaimRewards = (await currentTime()) + 10
      const userEarnedRewards = await getRewardsEarned(
        StakingRewardsDeployed,
        mockRewardsDistributionAddress,
        timeToClaimRewards
      )
      assert.bnEqual(userEarnedRewards, toBN(0))
      await setNextTimestamp(timeToClaimRewards)

      await StakingRewardsDeployed.compound({ from: mockRewardsDistributionAddress })

      assert.bnEqual(await rewardsToken.balanceOf(mockRewardsDistributionAddress), toBN(0))
      assert.bnEqual(
        await StakingRewardsDeployed.balanceOf(mockRewardsDistributionAddress),
        userTokenBalanceBefore
      )
      assert.bnEqual(await StakingRewardsDeployed.earned(mockRewardsDistributionAddress), toBN(0))
    })

    it('stakes unclaimed rewards if balance = 0 and unclaimed > 0', async () => {
      // stake tokens to get rewards and ensure unstaked balance is 0
      await StakingRewardsDeployed.stake(initialAmountToStake, {
        from: mockRewardsDistributionAddress,
      })
      assert.bnEqual(await rewardsToken.balanceOf(mockRewardsDistributionAddress), toBN(0))
      // estimate reward amount and ensure it is > 0
      timeToClaimRewards = (await currentTime()) + 10
      const userEarnedRewards = await getRewardsEarned(
        StakingRewardsDeployed,
        mockRewardsDistributionAddress,
        timeToClaimRewards
      )
      assert.bnGt(userEarnedRewards, toBN(0))
      // only need to approve estimated rewards and user should have no unstaked balance
      await rewardsToken.approve(StakingRewardsDeployed.address, userEarnedRewards, {
        from: mockRewardsDistributionAddress,
      })
      const userStakedTokenBalanceBefore = await StakingRewardsDeployed.balanceOf(
        mockRewardsDistributionAddress
      )
      await setNextTimestamp(timeToClaimRewards)

      await StakingRewardsDeployed.compound({ from: mockRewardsDistributionAddress })

      assert.bnEqual(await rewardsToken.balanceOf(mockRewardsDistributionAddress), toBN(0))
      assert.bnEqual(
        await StakingRewardsDeployed.balanceOf(mockRewardsDistributionAddress),
        userStakedTokenBalanceBefore.add(userEarnedRewards)
      )
      assert.bnEqual(await StakingRewardsDeployed.earned(mockRewardsDistributionAddress), toBN(0))
    })

    it('stakes both unstaked balance and unclaimed rewards if balance > 0 and unclaimed > 0', async () => {
      await StakingRewardsDeployed.stake(initialAmountToStake, {
        from: mockRewardsDistributionAddress,
      })
      // Send additional tokens to the user for compound to stake
      const secondAmountToStake = initialAmountToStake.add(toUnit(1))
      await rewardsToken.transfer(mockRewardsDistributionAddress, secondAmountToStake, {
        from: owner,
      })
      const userTokenBalanceBefore = await rewardsToken.balanceOf(mockRewardsDistributionAddress)
      assert.bnGt(userTokenBalanceBefore, toBN(0))
      timeToClaimRewards = (await currentTime()) + 10
      const userEarnedRewards = await getRewardsEarned(
        StakingRewardsDeployed,
        mockRewardsDistributionAddress,
        timeToClaimRewards
      )
      assert.bnGt(userEarnedRewards, toBN(0))
      // approve estimated rewards and unstaked balance
      await rewardsToken.approve(
        StakingRewardsDeployed.address,
        userTokenBalanceBefore.add(userEarnedRewards),
        {
          from: mockRewardsDistributionAddress,
        }
      )
      const userStakedTokenBalanceBefore = await StakingRewardsDeployed.balanceOf(
        mockRewardsDistributionAddress
      )
      await setNextTimestamp(timeToClaimRewards)

      await StakingRewardsDeployed.compound({ from: mockRewardsDistributionAddress })

      assert.bnEqual(await rewardsToken.balanceOf(mockRewardsDistributionAddress), toBN(0))
      assert.bnEqual(
        await StakingRewardsDeployed.balanceOf(mockRewardsDistributionAddress),
        userStakedTokenBalanceBefore.add(userTokenBalanceBefore.add(userEarnedRewards))
      )
      assert.bnEqual(await StakingRewardsDeployed.earned(mockRewardsDistributionAddress), toBN(0))
    })
  })

  describe('setRewardsDuration()', () => {
    const sevenDays = DAY * 7
    const seventyDays = DAY * 70

    it('should increase rewards duration before starting distribution', async () => {
      const defaultDuration = await StakingRewardsDeployed.rewardsDuration()
      assert.equal(defaultDuration, sevenDays)

      await StakingRewardsDeployed.setRewardsDuration(seventyDays, { from: owner })
      const newDuration = await StakingRewardsDeployed.rewardsDuration()
      assert.equal(newDuration, seventyDays)
    })

    it('should revert when setting setRewardsDuration before the period has finished', async () => {
      const totalToDistribute = toUnit('5000')

      await stakingToken.approve(StakingRewardsDeployed.address, toUnit(100), {
        from: mockRewardsDistributionAddress,
      })
      await StakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress })

      await rewardsToken.transfer(StakingRewardsDeployed.address, totalToDistribute, {
        from: owner,
      })
      await StakingRewardsDeployed.notifyRewardAmount(toUnit(10), {
        from: owner,
      })

      await fastForward(DAY)

      await assert.revert(
        StakingRewardsDeployed.setRewardsDuration(seventyDays, { from: owner }),
        'Previous rewards period must be complete before changing the duration for the new period'
      )
    })

    it('should update when setting setRewardsDuration after the period has finished', async () => {
      const totalToDistribute = toUnit('5000')
      await stakingToken.approve(StakingRewardsDeployed.address, toUnit(100), {
        from: mockRewardsDistributionAddress,
      })
      await StakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress })

      await rewardsToken.transfer(StakingRewardsDeployed.address, totalToDistribute, {
        from: owner,
      })
      await StakingRewardsDeployed.notifyRewardAmount(toUnit(20), {
        from: owner,
      })

      await fastForward(DAY * 8)

      const transaction = await StakingRewardsDeployed.setRewardsDuration(seventyDays, {
        from: owner,
      })
      assert.eventEqual(transaction, 'RewardsDurationUpdated', {
        newDuration: seventyDays,
      })

      const newDuration = await StakingRewardsDeployed.rewardsDuration()
      assert.equal(newDuration, seventyDays)

      await rewardsToken.transfer(StakingRewardsDeployed.address, totalToDistribute, {
        from: owner,
      })
      await StakingRewardsDeployed.notifyRewardAmount(toUnit(10), {
        from: owner,
      })
    })

    it('should update when setting setRewardsDuration after the period has finished', async () => {
      const totalToDistribute = toUnit('5000')
      await stakingToken.approve(StakingRewardsDeployed.address, toUnit(100), {
        from: mockRewardsDistributionAddress,
      })
      await StakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress })

      await rewardsToken.transfer(StakingRewardsDeployed.address, totalToDistribute, {
        from: owner,
      })
      await StakingRewardsDeployed.notifyRewardAmount(toUnit(10), {
        from: owner,
      })

      await fastForward(DAY * 4)
      await StakingRewardsDeployed.getReward({ from: mockRewardsDistributionAddress })
      await fastForward(DAY * 4)

      // New Rewards period much lower
      await rewardsToken.transfer(StakingRewardsDeployed.address, totalToDistribute, {
        from: owner,
      })
      const transaction = await StakingRewardsDeployed.setRewardsDuration(seventyDays, {
        from: owner,
      })
      assert.eventEqual(transaction, 'RewardsDurationUpdated', {
        newDuration: seventyDays,
      })

      const newDuration = await StakingRewardsDeployed.rewardsDuration()
      assert.bnEqual(newDuration, seventyDays)

      await StakingRewardsDeployed.notifyRewardAmount(toUnit(6), {
        from: owner,
      })

      await fastForward(DAY * 71)
      await StakingRewardsDeployed.getReward({ from: mockRewardsDistributionAddress })
    })
  })

  describe('getRewardForDuration()', () => {
    it('should increase rewards token balance', async () => {
      const totalToDistribute = toUnit('5000')
      await rewardsToken.transfer(StakingRewardsDeployed.address, totalToDistribute, {
        from: owner,
      })
      await StakingRewardsDeployed.notifyRewardAmount(toUnit(10), {
        from: owner,
      })

      const rewardForDuration = await StakingRewardsDeployed.getRewardForDuration()

      const duration = await StakingRewardsDeployed.rewardsDuration()
      const rewardRate = await StakingRewardsDeployed.rewardRate()

      assert.ok(rewardForDuration > 0)
      assert.equal(rewardForDuration.toString(), duration.mul(rewardRate).toString())
    })
  })

  describe('withdraw()', () => {
    it('should increases lp token balance and decreases staking balance', async () => {
      const totalToStake = toUnit(1)

      await stakingToken.approve(StakingRewardsDeployed.address, totalToStake, {
        from: mockRewardsDistributionAddress,
      })
      await StakingRewardsDeployed.stake(totalToStake, { from: mockRewardsDistributionAddress })

      await fastForward(300)

      const initialStakeBal = await StakingRewardsDeployed.balanceOf(mockRewardsDistributionAddress)

      await StakingRewardsDeployed.withdraw(toUnit(0.5), {
        from: mockRewardsDistributionAddress,
      })

      const postStakeBal = await StakingRewardsDeployed.balanceOf(mockRewardsDistributionAddress)

      assert.bnEqual(postStakeBal.add(toBN(toUnit(0.5))).toString(), initialStakeBal.toString())
    })
  })

  describe('exit()', () => {
    it('should retrieve all earned and increase rewards bal', async () => {
      const totalToDistribute = toUnit('5000')
      await stakingToken.approve(StakingRewardsDeployed.address, toUnit(100), {
        from: mockRewardsDistributionAddress,
      })
      await StakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress })

      await rewardsToken.transfer(StakingRewardsDeployed.address, totalToDistribute, {
        from: owner,
      })
      await StakingRewardsDeployed.notifyRewardAmount(toUnit(10), {
        from: owner,
      })

      await fastForward(DAY)

      const initialRewardBal = await rewardsToken.balanceOf(mockRewardsDistributionAddress)
      const initialEarnedBal = await StakingRewardsDeployed.earned(mockRewardsDistributionAddress)

      await StakingRewardsDeployed.exit({ from: mockRewardsDistributionAddress })

      const postRewardBal = await rewardsToken.balanceOf(mockRewardsDistributionAddress)
      const postEarnedBal = await StakingRewardsDeployed.earned(mockRewardsDistributionAddress)

      assert.ok(postEarnedBal < initialEarnedBal)
      assert.ok(postRewardBal > initialRewardBal)
      assert.equal(postEarnedBal, 0)
    })
  })

  describe('notifyRewardAmount()', () => {
    let rewardValue
    let rewardsDuration
    beforeEach(async () => {
      /**
       * toUnit is a web3.js method for converting amounts to token amounts,
       * comparable to ether's parseEther().
       */
      rewardValue = toUnit(1000)
      await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, {
        from: owner,
      })
      rewardsDuration = await StakingRewardsDeployed.rewardsDuration()
    })

    /**
     * reward rate * reward duration cannot exceed balance for rewards.
     * The contract does not directly compare the balance and the amount
     * needed for reward, but calculates the maximum reward rate based
     * on the balance available for rewards.
     *
     * Because this calculation involves integer division and results in
     * some precision loss, we cannot just add 1 to the balance reserved
     * for rewards as a test input. We need to find the nearest reward amount
     * that will result in a calculated reward rate that exceeds the max
     * reward rate.
     */
    describe('if no stakers', () => {
      /**
       * These existing testcases from Thales have been modified and moved
       * under `if no stakers`, since Thales's existing tests only tested
       * situations with no existing stakers.
       *
       * The testcases have been heavily modified to use calculated balances
       * that account for integer division loss explained above. Thales's
       * testcases simply used magic amounts that were high enough in
       * precision so that it didn't matter and because they didn't need to verify
       * amounts were calculated correctly (understandably because they didn't
       * modify the logic like we are).
       */
      let stakingContractBalance
      describe('if period finished', () => {
        beforeEach(async () => {
          await StakingRewardsDeployed.notifyRewardAmount(rewardValue, {
            from: owner,
          })
          await fastForward(WEEK)
          // transfer rewards for new period
          await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, {
            from: owner,
          })
          // refetch balance after new rewards are transferred
          stakingContractBalance = await rewardsToken.balanceOf(StakingRewardsDeployed.address)
        })

        it('reverts if reward > balance', async () => {
          assert.bnEqual(await StakingRewardsDeployed.totalSupply(), toBN(0))
          /**
           * Find next greater multiple of rewardsDuration to account for integer
           * division loss (because it divides by rewardsDuration).
           */
          const newRewardValue = getNearestGreaterMultiple(stakingContractBalance, rewardsDuration)

          await assert.revert(
            StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
              from: owner,
            }),
            'Provided reward too high'
          )
        })

        it('starts new reward if reward > balance but rounds down to balance', async () => {
          assert.bnEqual(await StakingRewardsDeployed.totalSupply(), toBN(0))
          /**
           * Find next greater multiple of rewardsDuration to account for integer
           * division loss (because it divides by rewardsDuration).
           */
          const newRewardValue = getNearestGreaterMultiple(
            stakingContractBalance,
            rewardsDuration
          ).sub(toBN(1))

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            await StakingRewardsDeployed.periodFinish(),
            StakingRewardsDeployed
          )
          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('starts new reward if reward = balance', async () => {
          assert.bnEqual(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const newRewardValue = stakingContractBalance

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            await StakingRewardsDeployed.periodFinish(),
            StakingRewardsDeployed
          )
          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('starts new reward if reward < balance', async () => {
          /**
           * Find next lower multiple of rewardsDuration to account for integer
           * division loss (because it divides by rewardsDuration).
           */
          const newRewardValue = getNearestLowerMultiple(stakingContractBalance, rewardsDuration)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            await StakingRewardsDeployed.periodFinish(),
            StakingRewardsDeployed
          )
          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('starts new reward of 0 if reward = 0', async () => {
          assert.bnEqual(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const newRewardValue = toBN(0)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(await StakingRewardsDeployed.getRewardForDuration(), toBN(0))
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })
      })

      describe('if period not finished', () => {
        let timeToNotifyRewards
        beforeEach(async () => {
          await StakingRewardsDeployed.notifyRewardAmount(rewardValue, {
            from: owner,
          })
          // transfer rewards for new period
          await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, {
            from: owner,
          })
          // refetch balance after new rewards are transferred
          stakingContractBalance = await rewardsToken.balanceOf(StakingRewardsDeployed.address)
          timeToNotifyRewards = (await currentTime()) + 10
        })

        it('reverts if reward after rollover > balance', async () => {
          assert.bnEqual(await StakingRewardsDeployed.totalSupply(), toBN(0))
          /**
           * Find the exact amount that will result in a reward rate above
           * the maximum.
           */
          const balanceForHigherRate = getNearestGreaterMultiple(
            stakingContractBalance,
            rewardsDuration
          )
          const leftoverRewards = await getLeftoverRewards(
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(leftoverRewards, toBN(0))
          const newRewardValue = balanceForHigherRate.sub(leftoverRewards)
          await setNextTimestamp(timeToNotifyRewards)

          await assert.revert(
            StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
              from: owner,
            }),
            'Provided reward too high'
          )
        })

        it('starts new reward if reward after rollover > balance but rounds down to balance', async () => {
          assert.bnEqual(await StakingRewardsDeployed.totalSupply(), toBN(0))
          /**
           * Find the exact amount that will result in a reward rate above
           * the maximum.
           */
          const balanceForHigherRate = getNearestGreaterMultiple(
            stakingContractBalance,
            rewardsDuration
          )
          const leftoverRewards = await getLeftoverRewards(
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(leftoverRewards, toBN(0))
          // Subtract 1 so that reward rate calculation rounds down
          const newRewardValue = balanceForHigherRate.sub(leftoverRewards).sub(toBN(1))
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          await setNextTimestamp(timeToNotifyRewards)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('starts new reward if reward after rollover = balance', async () => {
          assert.bnEqual(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const leftoverRewards = await getLeftoverRewards(
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(leftoverRewards, toBN(0))
          const newRewardValue = stakingContractBalance.sub(leftoverRewards)
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          await setNextTimestamp(timeToNotifyRewards)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('starts new reward if reward after rollover < balance', async () => {
          assert.bnEqual(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const leftoverRewards = await getLeftoverRewards(
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(leftoverRewards, toBN(0))
          const balanceForLowerRate = getNearestLowerMultiple(
            stakingContractBalance,
            rewardsDuration
          )
          const newRewardValue = balanceForLowerRate.sub(leftoverRewards)
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          await setNextTimestamp(timeToNotifyRewards)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('resets period with leftover rewards if reward = 0', async () => {
          assert.bnEqual(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const leftoverRewards = await getLeftoverRewards(
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(leftoverRewards, toBN(0))
          const newRewardValue = toBN(0)
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(expectedRewardForDuration, toBN(0))
          await setNextTimestamp(timeToNotifyRewards)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })
      })
    })

    describe('if existing stakers', () => {
      let balanceForRewards
      let rewardsDuration
      beforeEach(async () => {
        await rewardsToken.approve(StakingRewardsDeployed.address, initialAmountToStake, {
          from: mockRewardsDistributionAddress,
        })
        await StakingRewardsDeployed.stake(initialAmountToStake, {
          from: mockRewardsDistributionAddress,
        })
        rewardsDuration = await StakingRewardsDeployed.rewardsDuration()
      })

      describe('if period finished', () => {
        beforeEach(async () => {
          await StakingRewardsDeployed.notifyRewardAmount(rewardValue, {
            from: owner,
          })
          await fastForward(WEEK)
          // transfer rewards for new period
          await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, {
            from: owner,
          })
          // getRewardsBalance returns contract balance excluding staked assets
          balanceForRewards = await getRewardsBalance(rewardsToken, StakingRewardsDeployed)
        })

        it('reverts if new reward > balance', async () => {
          assert.bnGt(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const newRewardValue = getNearestGreaterMultiple(balanceForRewards, rewardsDuration)

          await assert.revert(
            StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
              from: owner,
            }),
            'Provided reward too high'
          )
        })

        it('starts new reward if reward > balance but rounds down to balance', async () => {
          assert.bnGt(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const newRewardValue = getNearestGreaterMultiple(balanceForRewards, rewardsDuration).sub(
            toBN(1)
          )
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            await StakingRewardsDeployed.periodFinish(),
            StakingRewardsDeployed
          )

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(await StakingRewardsDeployed.rewardsDuration())
          )
        })

        it('starts new reward if reward = balance', async () => {
          assert.bnGt(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const newRewardValue = await getRewardsBalance(rewardsToken, StakingRewardsDeployed)
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            await StakingRewardsDeployed.periodFinish(),
            StakingRewardsDeployed
          )

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('starts new reward if reward < balance', async () => {
          assert.bnGt(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const newRewardValue = getNearestLowerMultiple(balanceForRewards, rewardsDuration)
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            await StakingRewardsDeployed.periodFinish(),
            StakingRewardsDeployed
          )

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('starts new reward of 0 if reward = 0', async () => {
          assert.bnGt(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const newRewardValue = toBN(0)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(await StakingRewardsDeployed.getRewardForDuration(), toBN(0))
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })
      })

      describe('if period not finished', () => {
        let timeToNotifyRewards
        beforeEach(async () => {
          await StakingRewardsDeployed.notifyRewardAmount(rewardValue, {
            from: owner,
          })
          // transfer rewards for new period
          await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, {
            from: owner,
          })
          // refetch reward balance after new rewards are transferred
          balanceForRewards = await getRewardsBalance(rewardsToken, StakingRewardsDeployed)
          timeToNotifyRewards = (await currentTime()) + 10
        })

        it('reverts if new reward after rollover > balance', async () => {
          assert.bnGt(await StakingRewardsDeployed.totalSupply(), toBN(0))
          /**
           * Find the exact amount that will result in a reward rate above
           * the maximum.
           */
          const balanceForHigherRate = getNearestGreaterMultiple(balanceForRewards, rewardsDuration)
          const leftoverRewards = await getLeftoverRewards(
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(leftoverRewards, toBN(0))
          const newRewardValue = balanceForHigherRate.sub(leftoverRewards)
          await setNextTimestamp(timeToNotifyRewards)

          await assert.revert(
            StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
              from: owner,
            }),
            'Provided reward too high'
          )
        })

        it('starts new reward if reward after rollover > balance but rounds down to balance', async () => {
          assert.bnGt(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const balanceForHigherRate = getNearestGreaterMultiple(balanceForRewards, rewardsDuration)
          const leftoverRewards = await getLeftoverRewards(
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(leftoverRewards, toBN(0))
          const newRewardValue = balanceForHigherRate.sub(leftoverRewards).sub(toBN(1))
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          await setNextTimestamp(timeToNotifyRewards)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('starts new reward if reward after rollover = balance', async () => {
          assert.bnGt(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const leftoverRewards = await getLeftoverRewards(
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(leftoverRewards, toBN(0))
          const newRewardValue = balanceForRewards.sub(leftoverRewards)
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          await setNextTimestamp(timeToNotifyRewards)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('starts new reward if reward after rollover < balance', async () => {
          assert.bnGt(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const balanceForLowerRate = getNearestLowerMultiple(balanceForRewards, rewardsDuration)
          const leftoverRewards = await getLeftoverRewards(
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(leftoverRewards, toBN(0))
          const newRewardValue = balanceForLowerRate.sub(leftoverRewards)
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          await setNextTimestamp(timeToNotifyRewards)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })

        it('resets period with leftover rewards if reward = 0', async () => {
          assert.bnGt(await StakingRewardsDeployed.totalSupply(), toBN(0))
          const leftoverRewards = await getLeftoverRewards(
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(leftoverRewards, toBN(0))
          const newRewardValue = toBN(0)
          const expectedRewardForDuration = await getExpectedRewardForDuration(
            newRewardValue,
            timeToNotifyRewards,
            StakingRewardsDeployed
          )
          assert.bnGt(expectedRewardForDuration, toBN(0))
          await setNextTimestamp(timeToNotifyRewards)

          await StakingRewardsDeployed.notifyRewardAmount(newRewardValue, {
            from: owner,
          })

          assert.bnEqual(
            await StakingRewardsDeployed.getRewardForDuration(),
            expectedRewardForDuration
          )
          const lastTimestamp = toBN(await currentTime())
          assert.bnEqual(await StakingRewardsDeployed.lastUpdateTime(), lastTimestamp)
          assert.bnEqual(
            await StakingRewardsDeployed.periodFinish(),
            lastTimestamp.add(rewardsDuration)
          )
        })
      })
    })
  })

  describe('emergencyWithdraw()', () => {
    let balanceForRewards
    const rewardValue = toUnit(1000)
    beforeEach(async () => {
      // setup an existing staker
      await rewardsToken.approve(StakingRewardsDeployed.address, initialAmountToStake, {
        from: mockRewardsDistributionAddress,
      })
      await StakingRewardsDeployed.stake(initialAmountToStake, {
        from: mockRewardsDistributionAddress,
      })
      // setup an existing reward period
      await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, {
        from: owner,
      })
      await StakingRewardsDeployed.notifyRewardAmount(rewardValue, {
        from: owner,
      })
      // refetch reward balance after new rewards are transferred
      balanceForRewards = await getRewardsBalance(rewardsToken, StakingRewardsDeployed)
    })

    it('reverts if not called by owner', async () => {
      assert.notEqual(await StakingRewardsDeployed.owner(), mockRewardsDistributionAddress)

      await assert.revert(
        StakingRewardsDeployed.emergencyWithdraw({
          from: mockRewardsDistributionAddress,
        }),
        'Only the contract owner may perform this action'
      )
    })

    it('reverts if staking ended', async () => {
      await StakingRewardsDeployed.emergencyWithdraw({
        from: owner,
      })

      await assert.revert(
        StakingRewardsDeployed.emergencyWithdraw({
          from: owner,
        }),
        'Staking has ended'
      )
    })

    it('withdraws all rewards', async () => {
      const contractBalanceBefore = await rewardsToken.balanceOf(StakingRewardsDeployed.address)
      // Verify that the contract has staked tokens
      assert.bnGt(contractBalanceBefore, balanceForRewards)
      // Verify that the contract has rewards to withdraw
      assert.bnGt(balanceForRewards, toBN(0))
      const ownerBalanceBefore = await rewardsToken.balanceOf(owner)

      await StakingRewardsDeployed.emergencyWithdraw({
        from: owner,
      })

      assert.bnEqual(await rewardsToken.balanceOf(owner), ownerBalanceBefore.add(balanceForRewards))
      assert.bnEqual(
        await rewardsToken.balanceOf(StakingRewardsDeployed.address),
        contractBalanceBefore.sub(balanceForRewards)
      )
      assert.bnEqual(
        await rewardsToken.balanceOf(StakingRewardsDeployed.address),
        await StakingRewardsDeployed.totalSupply()
      )
    })

    it('stops users from claiming', async () => {
      await StakingRewardsDeployed.emergencyWithdraw({
        from: owner,
      })

      await assert.revert(
        StakingRewardsDeployed.getReward({
          from: mockRewardsDistributionAddress,
        }),
        'Staking has ended'
      )
    })

    it('stops users from staking', async () => {
      // Give more tokens to stake again
      await rewardsToken.transfer(mockRewardsDistributionAddress, initialAmountToStake, {
        from: owner,
      })

      await StakingRewardsDeployed.emergencyWithdraw({
        from: owner,
      })

      await assert.revert(
        StakingRewardsDeployed.stake(initialAmountToStake, {
          from: mockRewardsDistributionAddress,
        }),
        'Staking has ended'
      )
    })

    it('stops users from compounding', async () => {
      // Ensure user has rewards to compound
      await fastForward(DAY)
      assert.bnGt(await StakingRewardsDeployed.earned(mockRewardsDistributionAddress), toBN(0))

      await StakingRewardsDeployed.emergencyWithdraw({
        from: owner,
      })

      await assert.revert(
        StakingRewardsDeployed.compound({
          from: mockRewardsDistributionAddress,
        }),
        'Staking has ended'
      )
    })

    it('stops owner from adding rewards', async () => {
      // Give more tokens to add rewards again
      await rewardsToken.transfer(StakingRewardsDeployed.address, rewardValue, {
        from: owner,
      })

      await StakingRewardsDeployed.emergencyWithdraw({
        from: owner,
      })

      await assert.revert(
        StakingRewardsDeployed.notifyRewardAmount(rewardValue, {
          from: owner,
        }),
        'Staking has ended'
      )
    })

    it('stops users from calling exit if unclaimed > 0', async () => {
      // Ensure user has rewards to claim
      await fastForward(DAY)
      assert.bnGt(await StakingRewardsDeployed.earned(mockRewardsDistributionAddress), toBN(0))

      await StakingRewardsDeployed.emergencyWithdraw({
        from: owner,
      })

      await assert.revert(
        StakingRewardsDeployed.exit({
          from: mockRewardsDistributionAddress,
        }),
        'Staking has ended'
      )
    })

    it('stops users from calling exit if unclaimed = 0', async () => {
      // Fast forward to end of period and claim all rewards to zero out unclaimed
      await fastForward(WEEK)
      await StakingRewardsDeployed.getReward({
        from: mockRewardsDistributionAddress,
      })
      assert.bnEqual(await StakingRewardsDeployed.earned(mockRewardsDistributionAddress), toBN(0))

      await StakingRewardsDeployed.emergencyWithdraw({
        from: owner,
      })

      await assert.revert(
        StakingRewardsDeployed.exit({
          from: mockRewardsDistributionAddress,
        }),
        'Staking has ended'
      )
    })

    it('allows users to withdraw', async () => {
      const userBalanceBefore = await rewardsToken.balanceOf(mockRewardsDistributionAddress)
      const userStakedBalanceBefore = await StakingRewardsDeployed.balanceOf(
        mockRewardsDistributionAddress
      )
      assert.bnGt(userStakedBalanceBefore, toBN(0))

      await StakingRewardsDeployed.emergencyWithdraw({
        from: owner,
      })

      await StakingRewardsDeployed.withdraw(userStakedBalanceBefore, {
        from: mockRewardsDistributionAddress,
      })
      assert.bnEqual(
        await rewardsToken.balanceOf(mockRewardsDistributionAddress),
        userBalanceBefore.add(userStakedBalanceBefore)
      )
      assert.bnEqual(
        await StakingRewardsDeployed.balanceOf(mockRewardsDistributionAddress),
        toBN(0)
      )
    })
  })
})
