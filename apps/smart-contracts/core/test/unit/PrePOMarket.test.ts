import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber } from 'ethers'
import { formatBytes32String, parseEther } from 'ethers/lib/utils'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import {
  DEFAULT_ADMIN_ROLE,
  PERCENT_UNIT,
  MARKET_FEE_LIMIT,
  MINT_HOOK_KEY,
  REDEEM_HOOK_KEY,
  MINT_FEE_PERCENT_KEY,
  REDEEM_FEE_PERCENT_KEY,
  ZERO_ADDRESS,
} from 'prepo-constants'
import { utils, snapshots, Create2Address } from 'prepo-hardhat'
import { mockAddressBeaconFixture, mockUintBeaconFixture } from '../fixtures/BeaconFixtures'
import {
  fakeAccountListFixture,
  fakeMarketHookFixture,
  marketHookFixture,
  smockMarketHookFixture,
} from '../fixtures/HookFixture'
import { LongShortTokenAttachFixture } from '../fixtures/LongShortTokenFixture'
import { prePOMarketAttachFixture } from '../fixtures/PrePOMarketFixture'
import { prePOMarketFactoryFixture } from '../fixtures/PrePOMarketFactoryFixture'
import { smockTestERC20Fixture } from '../fixtures/TestERC20Fixture'
import { fakeTokenSenderFixture } from '../fixtures/TokenSenderFixture'
import {
  calculateFee,
  getLastTimestamp,
  getPermitFromSignature,
  revertsIfNotRoleHolder,
  testRoleConstants,
} from '../utils'
import { createMarket, generateLongShortSalts } from '../../helpers'
import { CreateMarketParams } from '../../types'
import {
  AddressBeacon,
  PrePOMarketFactory,
  PrePOMarket,
  LongShortToken,
  TestERC20,
  MarketHook,
  UintBeacon,
} from '../../types/generated'

chai.use(smock.matchers)

const { nowPlusMonths, setNextTimestamp } = utils
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> prePOMarket', () => {
  let collateralToken: MockContract<TestERC20>
  let prePOMarket: PrePOMarket
  let prePOMarketFactory: PrePOMarketFactory
  let mockAddressBeacon: MockContract<AddressBeacon>
  let mockUintBeacon: MockContract<UintBeacon>
  let deployer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let governance: SignerWithAddress
  let defaultParams: CreateMarketParams
  const TEST_NAME_SUFFIX = 'Fake Token ($5-10B)'
  const TEST_SYMBOL_SUFFIX = 'FAKE_5-10B'
  const TEST_FLOOR_VAL = 5
  const TEST_CEILING_VAL = 10
  const TEST_MINT_FEE_PERCENT = 10000 // 1%
  const TEST_REDEEM_FEE_PERCENT = 20
  const TEST_EXPIRY = nowPlusMonths(2)
  const TEST_FLOOR_PAYOUT = parseEther('0.2')
  const TEST_CEILING_PAYOUT = parseEther('0.8')
  const TEST_EXPIRY_PAYOUT = parseEther('0.5')
  const TEST_MINT_AMOUNT = parseEther('1000')
  const TEST_FINAL_LONG_PAYOUT = TEST_FLOOR_PAYOUT.add(TEST_CEILING_PAYOUT).div(2)
  const TEST_DEADLINE = nowPlusMonths(1)
  const MOCK_COLLATERAL_SUPPLY = parseEther('1000000000')
  const JUNK_PERMIT = <IPrePOMarket.PermitStruct>{
    deadline: 0,
    v: 0,
    r: formatBytes32String('JUNK_DATA'),
    s: formatBytes32String('JUNK_DATA'),
  }
  const JUNK_PAYLOAD = formatBytes32String('JUNK_PAYLOAD')
  snapshotter.setupSnapshotContext('prePOMarket')
  before(async () => {
    ;[deployer, user1, user2, governance] = await ethers.getSigners()
    collateralToken = await smockTestERC20Fixture('prePO USDC Collateral', 'preUSD', 18)
    await collateralToken.mint(deployer.address, MOCK_COLLATERAL_SUPPLY)
    prePOMarketFactory = await prePOMarketFactoryFixture()
    mockAddressBeacon = await mockAddressBeaconFixture()
    mockUintBeacon = await mockUintBeaconFixture()
    await prePOMarketFactory.setAddressBeacon(mockAddressBeacon.address)
    await prePOMarketFactory.setUintBeacon(mockUintBeacon.address)
    const { longTokenSalt, shortTokenSalt } = await generateLongShortSalts(
      ethers,
      prePOMarketFactory.address,
      collateralToken.address,
      TEST_NAME_SUFFIX,
      TEST_SYMBOL_SUFFIX,
      utils.generateLowerAddress
    )
    defaultParams = {
      factory: prePOMarketFactory,
      tokenNameSuffix: TEST_NAME_SUFFIX,
      tokenSymbolSuffix: TEST_SYMBOL_SUFFIX,
      longTokenSalt: longTokenSalt.salt,
      shortTokenSalt: shortTokenSalt.salt,
      parameters: {
        collateral: collateralToken.address,
        floorLongPayout: TEST_FLOOR_PAYOUT,
        ceilingLongPayout: TEST_CEILING_PAYOUT,
        expiryLongPayout: TEST_EXPIRY_PAYOUT,
        floorValuation: TEST_FLOOR_VAL,
        ceilingValuation: TEST_CEILING_VAL,
        expiryTime: TEST_EXPIRY,
      },
    }
    await snapshotter.saveSnapshot()
  })

  describe('initial state', () => {
    let longTokenSaltForRevertCase: Create2Address
    let shortTokenSaltForRevertCase: Create2Address
    snapshotter.setupSnapshotContext('prePOMarket-initial-state')
    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      /**
       * This was added because there is a problem with testing custom error reverts
       * for a constructor. The `revertedWithCustomError` matcher requires that the
       * contract throwing the error be passed into it, but with testing constructor
       * errors, this is obviously a chicken and egg problem. So since all cases in this
       * test need a prePOMarket to exist, we first instantiate one using the default
       * testing parameters. Then we generate a separate set of salts to pass in when testing
       * for the revert case so that it does not break due to duplicate long short tokens.
       */
      const alternativeSaltsForRevertCase = await generateLongShortSalts(
        ethers,
        prePOMarketFactory.address,
        collateralToken.address,
        TEST_NAME_SUFFIX,
        TEST_SYMBOL_SUFFIX,
        utils.generateLowerAddress
      )
      longTokenSaltForRevertCase = alternativeSaltsForRevertCase.longTokenSalt
      shortTokenSaltForRevertCase = alternativeSaltsForRevertCase.shortTokenSalt
      await snapshotter.saveSnapshot()
    })

    it('reverts if expiry payout < floor payout', async () => {
      await expect(
        createMarket(deployer, {
          ...defaultParams,
          longTokenSalt: longTokenSaltForRevertCase.salt,
          shortTokenSalt: shortTokenSaltForRevertCase.salt,
          parameters: {
            ...defaultParams.parameters,
            expiryLongPayout: TEST_FLOOR_PAYOUT.sub(1),
          },
        })
      ).revertedWithCustomError(prePOMarket, 'FinalPayoutTooLow')
    })

    it('reverts if expiry payout > ceiling payout', async () => {
      await expect(
        createMarket(deployer, {
          ...defaultParams,
          longTokenSalt: longTokenSaltForRevertCase.salt,
          shortTokenSalt: shortTokenSaltForRevertCase.salt,
          parameters: {
            ...defaultParams.parameters,
            expiryLongPayout: TEST_CEILING_PAYOUT.add(1),
          },
        })
      ).revertedWithCustomError(prePOMarket, 'FinalPayoutTooHigh')
    })

    it('reverts if floor = ceiling', async () => {
      await expect(
        createMarket(deployer, {
          ...defaultParams,
          longTokenSalt: longTokenSaltForRevertCase.salt,
          shortTokenSalt: shortTokenSaltForRevertCase.salt,
          parameters: {
            ...defaultParams.parameters,
            ceilingLongPayout: TEST_FLOOR_PAYOUT,
          },
        })
      ).revertedWithCustomError(prePOMarket, 'CeilingNotAboveFloor')
    })

    it('reverts if floor > ceiling', async () => {
      await expect(
        createMarket(deployer, {
          ...defaultParams,
          longTokenSalt: longTokenSaltForRevertCase.salt,
          shortTokenSalt: shortTokenSaltForRevertCase.salt,
          parameters: {
            ...defaultParams.parameters,
            floorLongPayout: TEST_CEILING_PAYOUT,
            ceilingLongPayout: TEST_FLOOR_PAYOUT,
          },
        })
      ).revertedWithCustomError(prePOMarket, 'CeilingNotAboveFloor')
    })

    it('reverts if ceiling > 1', async () => {
      await expect(
        createMarket(deployer, {
          ...defaultParams,
          longTokenSalt: longTokenSaltForRevertCase.salt,
          shortTokenSalt: shortTokenSaltForRevertCase.salt,
          parameters: {
            ...defaultParams.parameters,
            ceilingLongPayout: parseEther('1.01'),
          },
        })
      ).revertedWithCustomError(prePOMarket, 'CeilingTooHigh')
    })

    it('reverts if expiry before current time', async () => {
      const lastTimestamp = await getLastTimestamp()

      await expect(
        createMarket(deployer, {
          ...defaultParams,
          longTokenSalt: longTokenSaltForRevertCase.salt,
          shortTokenSalt: shortTokenSaltForRevertCase.salt,
          parameters: {
            ...defaultParams.parameters,
            expiryTime: lastTimestamp - 1,
          },
        })
      ).revertedWithCustomError(prePOMarket, 'ExpiryInPast')
    })

    it('reverts if expiry at current time', async () => {
      const lastTimestamp = await getLastTimestamp()

      await expect(
        createMarket(deployer, {
          ...defaultParams,
          longTokenSalt: longTokenSaltForRevertCase.salt,
          shortTokenSalt: shortTokenSaltForRevertCase.salt,
          parameters: {
            ...defaultParams.parameters,
            expiryTime: lastTimestamp,
          },
        })
      ).revertedWithCustomError(prePOMarket, 'ExpiryInPast')
    })

    it('initializes with constructor args', async () => {
      const longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      const shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())

      expect(await prePOMarket.getCollateral()).eq(collateralToken.address)
      expect(await longToken.owner()).eq(prePOMarket.address)
      expect(await shortToken.owner()).eq(prePOMarket.address)
      expect(await prePOMarket.getFloorLongPayout()).eq(TEST_FLOOR_PAYOUT)
      expect(await prePOMarket.getCeilingLongPayout()).eq(TEST_CEILING_PAYOUT)
      expect(await prePOMarket.getExpiryLongPayout()).eq(TEST_EXPIRY_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).eq(ethers.constants.MaxUint256)
      expect(await prePOMarket.getFloorValuation()).eq(TEST_FLOOR_VAL)
      expect(await prePOMarket.getCeilingValuation()).eq(TEST_CEILING_VAL)
      expect(await prePOMarket.getExpiryTime()).eq(TEST_EXPIRY)
      expect(await prePOMarket.getAddressBeacon()).eq(mockAddressBeacon.address)
      expect(await prePOMarket.getUintBeacon()).eq(mockUintBeacon.address)
      expect(await prePOMarket.PERCENT_UNIT()).eq(PERCENT_UNIT)
      expect(await prePOMarket.FEE_LIMIT()).eq(MARKET_FEE_LIMIT)
    })

    it('sets role constants to correct hash', async () => {
      await testRoleConstants([prePOMarket.SET_FINAL_LONG_PAYOUT_ROLE(), 'setFinalLongPayout'])
    })

    it("doesn't assign anyone to DEFAULT_ADMIN_ROLE", async () => {
      expect(await prePOMarket.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).eq(0)
    })

    it('assigns deployer to SET_FINAL_LONG_PAYOUT_ROLE', async () => {
      expect(
        await prePOMarket.hasRole(await prePOMarket.SET_FINAL_LONG_PAYOUT_ROLE(), deployer.address)
      ).eq(true)
    })

    it('assigns SET_FINAL_LONG_PAYOUT_ROLE as its own admin', async () => {
      const roleHash = await prePOMarket.SET_FINAL_LONG_PAYOUT_ROLE()

      expect(await prePOMarket.getRoleAdmin(roleHash)).eq(roleHash)
    })
  })

  describe('# setFinalLongPayout', () => {
    snapshotter.setupSnapshotContext('prePOMarket-setFinalLongPayout')

    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      await snapshotter.saveSnapshot()
    })

    it('reverts if not role holder', async () => {
      await revertsIfNotRoleHolder(
        prePOMarket.SET_FINAL_LONG_PAYOUT_ROLE(),
        prePOMarket.populateTransaction.setFinalLongPayout(parseEther('1'))
      )
    })

    it('reverts if value set more than once', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))
      expect(await prePOMarket.getFinalLongPayout()).eq(TEST_CEILING_PAYOUT.sub(1))

      const tx = prePOMarket.connect(deployer).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))

      await expect(tx).revertedWithCustomError(prePOMarket, 'MarketEnded')
    })

    it('should not be settable beyond ceiling', async () => {
      await expect(
        prePOMarket.connect(deployer).setFinalLongPayout(TEST_CEILING_PAYOUT.add(1))
      ).revertedWithCustomError(prePOMarket, 'FinalPayoutTooHigh')
    })

    it('should not be settable below floor', async () => {
      await expect(
        prePOMarket.connect(deployer).setFinalLongPayout(TEST_FLOOR_PAYOUT.sub(1))
      ).revertedWithCustomError(prePOMarket, 'FinalPayoutTooLow')
    })

    it('should be settable to value between payout and ceiling', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))

      expect(await prePOMarket.getFinalLongPayout()).eq(TEST_CEILING_PAYOUT.sub(1))
    })

    it('should emit a FinalLongPayoutSet event', async () => {
      const tx = await prePOMarket.connect(deployer).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))

      await expect(tx).emit(prePOMarket, 'FinalLongPayoutSet').withArgs(TEST_CEILING_PAYOUT.sub(1))
    })
  })

  describe('# setFinalLongPayoutAfterExpiry', () => {
    snapshotter.setupSnapshotContext('prePOMarket-setFinalLongPayout')

    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      await snapshotter.saveSnapshot()
    })

    it('reverts if expiry time not passed', async () => {
      await setNextTimestamp(ethers.provider, Number(defaultParams.parameters.expiryTime))

      await expect(
        prePOMarket.connect(deployer).setFinalLongPayoutAfterExpiry()
      ).revertedWithCustomError(prePOMarket, 'ExpiryNotPassed')
    })

    it('reverts if final payout already set and expiry passed', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))
      await setNextTimestamp(ethers.provider, Number(defaultParams.parameters.expiryTime) + 1)

      await expect(
        prePOMarket.connect(deployer).setFinalLongPayoutAfterExpiry()
      ).revertedWithCustomError(prePOMarket, 'MarketEnded')
    })

    it('sets final payout to expiry payout if expiry passed', async () => {
      expect(await prePOMarket.getFinalLongPayout()).not.eq(
        defaultParams.parameters.expiryLongPayout
      )
      await setNextTimestamp(ethers.provider, Number(defaultParams.parameters.expiryTime) + 1)

      await prePOMarket.connect(deployer).setFinalLongPayoutAfterExpiry()

      expect(await prePOMarket.getFinalLongPayout()).eq(defaultParams.parameters.expiryLongPayout)
    })
  })

  describe('# getFeePercent', () => {
    snapshotter.setupSnapshotContext('prePOMarket-getFeePercent')

    before(async () => {
      await mockUintBeacon.set(MINT_FEE_PERCENT_KEY, TEST_MINT_FEE_PERCENT)
      await snapshotter.saveSnapshot()
    })

    it('returns 0 if custom fee = max uint256', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      await mockUintBeacon.set(
        utils.getZeroPadHexFromAddress(prePOMarket.address),
        ethers.constants.MaxUint256
      )

      expect(await prePOMarket.getFeePercent(MINT_FEE_PERCENT_KEY)).eq(0)
    })

    it('returns custom fee if custom fee > 0 and < FEE_LIMIT', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      await mockUintBeacon.set(
        utils.getZeroPadHexFromAddress(prePOMarket.address),
        MARKET_FEE_LIMIT - 1
      )

      expect(await prePOMarket.getFeePercent(MINT_FEE_PERCENT_KEY)).eq(MARKET_FEE_LIMIT - 1)
    })

    it('returns FEE_LIMIT if custom fee = FEE_LIMIT', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      await mockUintBeacon.set(
        utils.getZeroPadHexFromAddress(prePOMarket.address),
        MARKET_FEE_LIMIT
      )

      expect(await prePOMarket.getFeePercent(MINT_FEE_PERCENT_KEY)).eq(MARKET_FEE_LIMIT)
    })

    it('returns FEE_LIMIT if custom fee > FEE_LIMIT', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      await mockUintBeacon.set(
        utils.getZeroPadHexFromAddress(prePOMarket.address),
        MARKET_FEE_LIMIT + 1
      )

      expect(await prePOMarket.getFeePercent(MINT_FEE_PERCENT_KEY)).eq(MARKET_FEE_LIMIT)
    })

    it('returns default fee if custom fee = 0', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      await mockUintBeacon.set(utils.getZeroPadHexFromAddress(prePOMarket.address), 0)

      expect(await prePOMarket.getFeePercent(MINT_FEE_PERCENT_KEY)).eq(TEST_MINT_FEE_PERCENT)
    })

    it('returns 0 if default fee = 0 and custom fee = 0', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      await mockUintBeacon.set(utils.getZeroPadHexFromAddress(prePOMarket.address), 0)
      await mockUintBeacon.set(MINT_FEE_PERCENT_KEY, 0)

      expect(await prePOMarket.getFeePercent(MINT_FEE_PERCENT_KEY)).eq(0)
    })

    it('returns FEE_LIMIT if default fee = FEE_LIMIT and custom fee = 0', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      await mockUintBeacon.set(utils.getZeroPadHexFromAddress(prePOMarket.address), 0)
      await mockUintBeacon.set(MINT_FEE_PERCENT_KEY, MARKET_FEE_LIMIT)

      expect(await prePOMarket.getFeePercent(MINT_FEE_PERCENT_KEY)).eq(MARKET_FEE_LIMIT)
    })

    it('returns FEE_LIMIT if default fee > FEE_LIMIT and custom fee = 0', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      await mockUintBeacon.set(utils.getZeroPadHexFromAddress(prePOMarket.address), 0)
      await mockUintBeacon.set(MINT_FEE_PERCENT_KEY, MARKET_FEE_LIMIT + 1)

      expect(await prePOMarket.getFeePercent(MINT_FEE_PERCENT_KEY)).eq(MARKET_FEE_LIMIT)
    })
  })

  describe('# mint', () => {
    let mintHook: MockContract<MarketHook>
    let longToken: LongShortToken
    let shortToken: LongShortToken
    const expectedMintingFeeAmount = TEST_MINT_AMOUNT.mul(TEST_MINT_FEE_PERCENT).div(PERCENT_UNIT)
    const expectedLongShortAmount = TEST_MINT_AMOUNT.sub(expectedMintingFeeAmount)
    snapshotter.setupSnapshotContext('prePOMarket-mint')
    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())
      mintHook = await smockMarketHookFixture()
      const tokenSender = await fakeTokenSenderFixture()
      await mintHook.connect(deployer).setTreasury(governance.address)
      await mintHook.connect(deployer).setTokenSender(tokenSender.address)
      await mockAddressBeacon.connect(deployer).set(MINT_HOOK_KEY, mintHook.address)
      await mockUintBeacon.connect(deployer).set(MINT_FEE_PERCENT_KEY, TEST_MINT_FEE_PERCENT)
      await collateralToken.connect(deployer).transfer(user1.address, TEST_MINT_AMOUNT)
      // Give infinite approval so that approval event is only emitted when an actual approval is given
      await collateralToken.connect(user1).approve(prePOMarket.address, ethers.constants.MaxUint256)
      await snapshotter.saveSnapshot()
    })

    it('reverts if amount = 0 and fee percent = 0%', async () => {
      await mockUintBeacon.connect(deployer).set(MINT_FEE_PERCENT_KEY, 0)

      await expect(
        prePOMarket.connect(user1).mint(0, user2.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'ZeroCollateralAmount')
    })

    it('reverts if amount = 0, fee percent > 0%', async () => {
      expect(await mockUintBeacon.get(MINT_FEE_PERCENT_KEY)).gt(0)

      await expect(
        prePOMarket.connect(user1).mint(0, user2.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'FeeRoundsToZero')
    })

    it('reverts if hook reverts', async () => {
      // We use a fake contract here because for some reason forcing reverts on the existing mock does not work here
      const revertingMintHook = await fakeMarketHookFixture()
      await mockAddressBeacon.connect(deployer).set(MINT_HOOK_KEY, revertingMintHook.address)
      revertingMintHook['hook(address,address,uint256,uint256,bytes)'].reverts()

      await expect(prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD))
        .reverted
    })

    it('reverts if market ended', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)

      await expect(
        prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'MarketEnded')
    })

    it('reverts if amount > 0, fee amount = 0, and fee > 0%', async () => {
      expect(await mockUintBeacon.get(MINT_FEE_PERCENT_KEY)).gt(0)
      /**
       * Given a test fee of 10000 (1%), a mint amount that would result in a
       * fee of 1 wei would be 100 wei, so for fee to = 0, mint 99.
       */
      const mintAmountResultingInZeroFee = BigNumber.from(99)
      expect(mintAmountResultingInZeroFee.mul(TEST_MINT_FEE_PERCENT).div(PERCENT_UNIT)).eq(0)

      await expect(
        prePOMarket.connect(user1).mint(mintAmountResultingInZeroFee, user2.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'FeeRoundsToZero')
    })

    it('reverts if collateral amount exceeds collateral balance', async () => {
      const funderCTBefore = await collateralToken.balanceOf(user1.address)
      await collateralToken.connect(user1).approve(prePOMarket.address, funderCTBefore.add(1))

      await expect(
        prePOMarket.connect(user1).mint(funderCTBefore.add(1), user2.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'InsufficientCollateral')
    })

    it('reverts if collateral amount exceeds collateral approval', async () => {
      const funderCTBefore = await collateralToken.balanceOf(user1.address)
      await collateralToken.connect(user1).approve(prePOMarket.address, funderCTBefore.sub(1))

      await expect(
        prePOMarket.connect(user1).mint(funderCTBefore, user2.address, JUNK_PAYLOAD)
      ).revertedWith('ERC20: insufficient allowance')
    })

    it('retrieves hook with correct key if address beacon set', async () => {
      expect(await prePOMarket.getAddressBeacon()).eq(mockAddressBeacon.address)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(mockAddressBeacon.get).calledWith(MINT_HOOK_KEY)
    })

    it('retrieves fee with correct key if uint beacon set', async () => {
      expect(await prePOMarket.getUintBeacon()).eq(mockUintBeacon.address)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(mockUintBeacon.get).calledWith(MINT_FEE_PERCENT_KEY)
    })

    it('transfers collateral from funder if funder = recipient', async () => {
      const marketCTBefore = await collateralToken.balanceOf(prePOMarket.address)
      const funderCTBefore = await collateralToken.balanceOf(user1.address)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user1.address, JUNK_PAYLOAD)

      expect(await collateralToken.balanceOf(prePOMarket.address)).eq(
        marketCTBefore.add(expectedLongShortAmount)
      )
      expect(await collateralToken.balanceOf(user1.address)).eq(
        funderCTBefore.sub(TEST_MINT_AMOUNT)
      )
    })

    it('transfers collateral from funder if funder != recipient', async () => {
      const marketCTBefore = await collateralToken.balanceOf(prePOMarket.address)
      const funderCTBefore = await collateralToken.balanceOf(user1.address)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(await collateralToken.balanceOf(prePOMarket.address)).eq(
        marketCTBefore.add(expectedLongShortAmount)
      )
      expect(await collateralToken.balanceOf(user1.address)).eq(
        funderCTBefore.sub(TEST_MINT_AMOUNT)
      )
    })

    it("doesn't approve fee if hook not set", async () => {
      await mockAddressBeacon.connect(deployer).set(MINT_HOOK_KEY, ZERO_ADDRESS)

      const tx = await prePOMarket
        .connect(user1)
        .mint(TEST_MINT_AMOUNT, user1.address, JUNK_PAYLOAD)

      await expect(tx).not.emit(collateralToken, 'Approval')
      expect(await collateralToken.allowance(prePOMarket.address, mintHook.address)).eq(0)
    })

    it("doesn't approve fee if fee percent = 0%", async () => {
      await mockUintBeacon.connect(deployer).set(MINT_FEE_PERCENT_KEY, 0)

      const tx = await prePOMarket
        .connect(user1)
        .mint(TEST_MINT_AMOUNT, user1.address, JUNK_PAYLOAD)

      await expect(tx).not.emit(collateralToken, 'Approval')
    })

    it('approves fee for hook to use', async () => {
      expect(expectedMintingFeeAmount).gt(0)

      const tx = await prePOMarket
        .connect(user1)
        .mint(TEST_MINT_AMOUNT, user1.address, JUNK_PAYLOAD)

      await expect(tx)
        .emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, mintHook.address, expectedMintingFeeAmount)
    })

    it('sets approval back to 0', async () => {
      expect(expectedMintingFeeAmount).gt(0)

      const tx = await prePOMarket
        .connect(user1)
        .mint(TEST_MINT_AMOUNT, user1.address, JUNK_PAYLOAD)

      await expect(tx)
        .emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, mintHook.address, expectedMintingFeeAmount)
      await expect(tx)
        .emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, mintHook.address, 0)
      expect(await collateralToken.allowance(prePOMarket.address, mintHook.address)).eq(0)
    })

    it('mints long and short tokens in equal amounts to funder if funder = recipient', async () => {
      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user1.address, JUNK_PAYLOAD)

      expect(await longToken.balanceOf(user1.address)).eq(expectedLongShortAmount)
      expect(await shortToken.balanceOf(user1.address)).eq(expectedLongShortAmount)
    })

    it('mints to recipient if funder != recipient', async () => {
      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(await longToken.balanceOf(user2.address)).eq(expectedLongShortAmount)
      expect(await shortToken.balanceOf(user2.address)).eq(expectedLongShortAmount)
    })

    it('mints using amount with full fee subtracted if hook takes full fee', async () => {
      const funderCTBefore = await collateralToken.balanceOf(user1.address)
      const treasuryCTBefore = await collateralToken.balanceOf(governance.address)
      const marketCTBefore = await collateralToken.balanceOf(prePOMarket.address)
      const recipientLongBefore = await longToken.balanceOf(user2.address)
      const recipientShortBefore = await shortToken.balanceOf(user2.address)
      expect(expectedMintingFeeAmount).gt(0)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(await collateralToken.balanceOf(user1.address)).eq(
        funderCTBefore.sub(TEST_MINT_AMOUNT)
      )
      expect(await collateralToken.balanceOf(governance.address)).eq(
        treasuryCTBefore.add(expectedMintingFeeAmount)
      )
      expect(await collateralToken.balanceOf(prePOMarket.address)).eq(
        marketCTBefore.add(TEST_MINT_AMOUNT).sub(expectedMintingFeeAmount)
      )
      expect(await longToken.balanceOf(user2.address)).eq(
        recipientLongBefore.add(expectedLongShortAmount)
      )
      expect(await shortToken.balanceOf(user2.address)).eq(
        recipientShortBefore.add(expectedLongShortAmount)
      )
    })

    it('mints using amount with partial fee subtracted if hook takes partial fee', async () => {
      // TestMarketHook meant to take 50% of the fee
      const factory = await ethers.getContractFactory('TestMarketHook')
      const partialFeeMintHook = await factory.connect(deployer).deploy(governance.address, 500000)
      const funderCTBefore = await collateralToken.balanceOf(user1.address)
      const treasuryCTBefore = await collateralToken.balanceOf(governance.address)
      const marketCTBefore = await collateralToken.balanceOf(prePOMarket.address)
      const recipientLongBefore = await longToken.balanceOf(user2.address)
      const recipientShortBefore = await shortToken.balanceOf(user2.address)
      await mockAddressBeacon.connect(deployer).set(MINT_HOOK_KEY, partialFeeMintHook.address)
      const expectedPartialFeeAmount = expectedMintingFeeAmount.div(2)
      expect(expectedPartialFeeAmount).gt(0)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(await collateralToken.balanceOf(user1.address)).eq(
        funderCTBefore.sub(TEST_MINT_AMOUNT)
      )
      expect(await collateralToken.balanceOf(governance.address)).eq(
        treasuryCTBefore.add(expectedPartialFeeAmount)
      )
      expect(await collateralToken.balanceOf(prePOMarket.address)).eq(
        marketCTBefore.add(TEST_MINT_AMOUNT).sub(expectedPartialFeeAmount)
      )
      expect(await longToken.balanceOf(user2.address)).eq(
        recipientLongBefore.add(TEST_MINT_AMOUNT.sub(expectedPartialFeeAmount))
      )
      expect(await shortToken.balanceOf(user2.address)).eq(
        recipientShortBefore.add(TEST_MINT_AMOUNT.sub(expectedPartialFeeAmount))
      )
    })

    it('mints using full collateral amount if hook takes no fee', async () => {
      // TestMarketHook meant to take 0% of the fee
      const factory = await ethers.getContractFactory('TestMarketHook')
      const noFeeMintHook = await factory.connect(deployer).deploy(governance.address, 0)
      const funderCTBefore = await collateralToken.balanceOf(user1.address)
      const treasuryCTBefore = await collateralToken.balanceOf(governance.address)
      const marketCTBefore = await collateralToken.balanceOf(prePOMarket.address)
      const recipientLongBefore = await longToken.balanceOf(user2.address)
      const recipientShortBefore = await shortToken.balanceOf(user2.address)
      await mockAddressBeacon.connect(deployer).set(MINT_HOOK_KEY, noFeeMintHook.address)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(await collateralToken.balanceOf(user1.address)).eq(
        funderCTBefore.sub(TEST_MINT_AMOUNT)
      )
      expect(await collateralToken.balanceOf(governance.address)).eq(treasuryCTBefore)
      expect(await collateralToken.balanceOf(prePOMarket.address)).eq(
        marketCTBefore.add(TEST_MINT_AMOUNT)
      )
      expect(await longToken.balanceOf(user2.address)).eq(recipientLongBefore.add(TEST_MINT_AMOUNT))
      expect(await shortToken.balanceOf(user2.address)).eq(
        recipientShortBefore.add(TEST_MINT_AMOUNT)
      )
    })

    it('mints using full collateral amount if hook not set', async () => {
      await mockAddressBeacon.connect(deployer).set(MINT_HOOK_KEY, ZERO_ADDRESS)
      const funderCTBefore = await collateralToken.balanceOf(user1.address)
      const treasuryCTBefore = await collateralToken.balanceOf(governance.address)
      const marketCTBefore = await collateralToken.balanceOf(prePOMarket.address)
      const recipientLongBefore = await longToken.balanceOf(user2.address)
      const recipientShortBefore = await shortToken.balanceOf(user2.address)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(await collateralToken.balanceOf(user1.address)).eq(
        funderCTBefore.sub(TEST_MINT_AMOUNT)
      )
      expect(await collateralToken.balanceOf(governance.address)).eq(treasuryCTBefore)
      expect(await collateralToken.balanceOf(prePOMarket.address)).eq(
        marketCTBefore.add(TEST_MINT_AMOUNT)
      )
      expect(await longToken.balanceOf(user2.address)).eq(recipientLongBefore.add(TEST_MINT_AMOUNT))
      expect(await shortToken.balanceOf(user2.address)).eq(
        recipientShortBefore.add(TEST_MINT_AMOUNT)
      )
    })

    it('ignores hook if not set and fee percent > 0%', async () => {
      await mockAddressBeacon.connect(deployer).set(MINT_HOOK_KEY, ZERO_ADDRESS)
      expect(await mockUintBeacon.get(MINT_FEE_PERCENT_KEY)).gt(0)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(mintHook['hook(address,address,uint256,uint256,bytes)']).not.called
    })

    it('ignores hook if not set and fee percent = 0%', async () => {
      await mockAddressBeacon.connect(deployer).set(MINT_HOOK_KEY, ZERO_ADDRESS)
      await mockUintBeacon.connect(deployer).set(MINT_FEE_PERCENT_KEY, 0)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(mintHook['hook(address,address,uint256,uint256,bytes)']).not.called
    })

    it('calls hook with correct parameters if funder = recipient', async () => {
      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user1.address, JUNK_PAYLOAD)

      expect(mintHook['hook(address,address,uint256,uint256,bytes)']).calledWith(
        user1.address,
        user1.address,
        TEST_MINT_AMOUNT,
        expectedLongShortAmount,
        JUNK_PAYLOAD
      )
    })

    it('calls hook with correct parameters if funder != recipient', async () => {
      expect(user1.address).not.eq(user2.address)

      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(mintHook['hook(address,address,uint256,uint256,bytes)']).calledWith(
        user1.address,
        user2.address,
        TEST_MINT_AMOUNT,
        expectedLongShortAmount,
        JUNK_PAYLOAD
      )
    })

    it('emits Mint', async () => {
      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      const mintFilter = {
        address: prePOMarket.address,
        topics: [
          ethers.utils.id('Mint(address,address,uint256,uint256)'),
          ethers.utils.hexZeroPad(user1.address, 32),
          ethers.utils.hexZeroPad(user2.address, 32),
        ],
      }
      const mintEvents = await prePOMarket.queryFilter(mintFilter)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mintEvent = mintEvents[0].args as any

      expect(await mintEvent.funder).eq(user1.address)
      expect(await mintEvent.recipient).eq(user2.address)
      expect(await mintEvent.amountAfterFee).eq(expectedLongShortAmount)
      expect(await mintEvent.fee).eq(expectedMintingFeeAmount)
    })

    it('returns long short tokens minted', async () => {
      expect(
        await prePOMarket
          .connect(user1)
          .callStatic.mint(TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)
      ).eq(expectedLongShortAmount)
    })

    afterEach(() => {
      mintHook['hook(address,address,uint256,uint256,bytes)'].reset()
      mockUintBeacon.get.reset()
      mockAddressBeacon.get.reset()
    })
  })

  describe('# permitAndMint', () => {
    let mintHook: MockContract<MarketHook>
    let longToken: LongShortToken
    let shortToken: LongShortToken
    let permitForFunder: IPrePOMarket.PermitStruct
    const expectedMintingFeeAmount = TEST_MINT_AMOUNT.mul(TEST_MINT_FEE_PERCENT).div(PERCENT_UNIT)
    const expectedLongShortAmount = TEST_MINT_AMOUNT.sub(expectedMintingFeeAmount)
    snapshotter.setupSnapshotContext('prePOMarket-permitAndMint')
    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      mintHook = await smockMarketHookFixture()
      const tokenSender = await fakeTokenSenderFixture()
      await mintHook.connect(deployer).setTreasury(governance.address)
      await mintHook.connect(deployer).setTokenSender(tokenSender.address)
      await mockAddressBeacon.connect(deployer).set(MINT_HOOK_KEY, mintHook.address)
      await mockUintBeacon.connect(deployer).set(MINT_FEE_PERCENT_KEY, TEST_MINT_FEE_PERCENT)
      longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())
      permitForFunder = await getPermitFromSignature(
        collateralToken,
        user1,
        prePOMarket.address,
        ethers.constants.MaxUint256,
        TEST_DEADLINE
      )
      await snapshotter.saveSnapshot()
    })

    it('processes collateral permit if deadline != 0', async () => {
      await collateralToken.connect(deployer).transfer(user1.address, TEST_MINT_AMOUNT)
      expect(await collateralToken.allowance(user1.address, prePOMarket.address)).eq(0)
      const userCTBefore = await collateralToken.balanceOf(user1.address)
      const treasuryCTBefore = await collateralToken.balanceOf(governance.address)
      const marketCTBefore = await collateralToken.balanceOf(prePOMarket.address)

      await prePOMarket
        .connect(user1)
        .permitAndMint(permitForFunder, TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(collateralToken.permit).calledWith(
        user1.address,
        prePOMarket.address,
        ethers.constants.MaxUint256,
        permitForFunder.deadline,
        permitForFunder.v,
        permitForFunder.r,
        permitForFunder.s
      )
      expect(await collateralToken.allowance(user1.address, prePOMarket.address)).eq(
        ethers.constants.MaxUint256
      )
      expect(await longToken.balanceOf(user2.address)).eq(expectedLongShortAmount)
      expect(await shortToken.balanceOf(user2.address)).eq(expectedLongShortAmount)
      expect(await collateralToken.balanceOf(user1.address)).eq(userCTBefore.sub(TEST_MINT_AMOUNT))
      expect(await collateralToken.balanceOf(governance.address)).eq(
        treasuryCTBefore.add(expectedMintingFeeAmount)
      )
      expect(await collateralToken.balanceOf(prePOMarket.address)).eq(
        marketCTBefore.add(TEST_MINT_AMOUNT.sub(expectedMintingFeeAmount))
      )
    })

    it('ignores collateral permit if deadline = 0', async () => {
      await collateralToken.connect(deployer).transfer(user1.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user1).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      const userCTBefore = await collateralToken.balanceOf(user1.address)
      const treasuryCTBefore = await collateralToken.balanceOf(governance.address)
      const marketCTBefore = await collateralToken.balanceOf(prePOMarket.address)

      await prePOMarket
        .connect(user1)
        .permitAndMint(JUNK_PERMIT, TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(collateralToken.permit).not.called
      expect(await longToken.balanceOf(user2.address)).eq(expectedLongShortAmount)
      expect(await shortToken.balanceOf(user2.address)).eq(expectedLongShortAmount)
      expect(await collateralToken.balanceOf(user1.address)).eq(userCTBefore.sub(TEST_MINT_AMOUNT))
      expect(await collateralToken.balanceOf(governance.address)).eq(
        treasuryCTBefore.add(expectedMintingFeeAmount)
      )
      expect(await collateralToken.balanceOf(prePOMarket.address)).eq(
        marketCTBefore.add(TEST_MINT_AMOUNT.sub(expectedMintingFeeAmount))
      )
    })

    afterEach(() => {
      mintHook['hook(address,address,uint256,uint256,bytes)'].reset()
      collateralToken.permit.reset()
    })
  })

  describe('# redeem', () => {
    let longToken: LongShortToken
    let shortToken: LongShortToken
    let redeemHook: FakeContract<MarketHook>
    snapshotter.setupSnapshotContext('prePOMarket-redeem')
    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(deployer, defaultParams))
      redeemHook = await fakeMarketHookFixture()
      await collateralToken.connect(deployer).transfer(user1.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user1).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      await prePOMarket.connect(user1).mint(TEST_MINT_AMOUNT, user1.address, JUNK_PAYLOAD)
      longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())
      await mockAddressBeacon.connect(deployer).set(REDEEM_HOOK_KEY, redeemHook.address)
      await mockUintBeacon.connect(deployer).set(REDEEM_FEE_PERCENT_KEY, TEST_REDEEM_FEE_PERCENT)
    })

    const calculateTotalOwed = async (
      longToRedeem: BigNumber,
      shortToRedeem: BigNumber,
      finalPayoutSet: boolean
    ): Promise<BigNumber> => {
      let totalOwed: BigNumber
      if (finalPayoutSet) {
        totalOwed = longToRedeem
      } else {
        const owedForLongs = longToRedeem
          .mul(await prePOMarket.getFinalLongPayout())
          .div(parseEther('1'))
        const owedForShort = shortToRedeem
          .mul(parseEther('1').sub(await prePOMarket.getFinalLongPayout()))
          .div(parseEther('1'))
        totalOwed = owedForLongs.add(owedForShort)
      }
      return totalOwed
    }

    it('reverts if amounts = 0, fee = 0%, and before market end', async () => {
      await mockUintBeacon.connect(deployer).set(REDEEM_FEE_PERCENT_KEY, 0)

      await expect(
        prePOMarket.connect(user1).redeem(0, 0, user1.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'ZeroCollateralAmount')
    })

    it('reverts if amounts = 0, fee = 0%, and after market end', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).lte(parseEther('1'))
      await mockUintBeacon.connect(deployer).set(REDEEM_FEE_PERCENT_KEY, 0)

      await expect(
        prePOMarket.connect(user1).redeem(0, 0, user1.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'ZeroCollateralAmount')
    })

    it('reverts if amounts = 0, fee > 0%, and before market end', async () => {
      expect(await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY)).gt(0)

      await expect(
        prePOMarket.connect(user1).redeem(0, 0, user1.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'FeeRoundsToZero')
    })

    it('reverts if amounts = 0, fee > 0%, and after market end', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).lte(parseEther('1'))
      expect(await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY)).gt(0)

      await expect(
        prePOMarket.connect(user1).redeem(0, 0, user1.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'FeeRoundsToZero')
    })

    it('reverts if hook reverts', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = TEST_MINT_AMOUNT
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      redeemHook['hook(address,address,uint256,uint256,bytes)'].reverts()

      await expect(
        prePOMarket.connect(user1).redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)
      ).reverted
    })

    it('reverts if amounts > 0, fee amount = 0, fee > 0%, and redeeming equal parts', async () => {
      expect(await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY)).gt(0)
      /**
       * Given a test fee of 20 (0.002%), smallest redemption that would result in a
       * fee(of 1) would be 50000 wei, so for fee = 0, redeem 49999.
       */
      const longToRedeem = BigNumber.from(49999)
      const shortToRedeem = longToRedeem
      expect(await longToken.balanceOf(user1.address)).gte(longToRedeem)
      expect(await shortToken.balanceOf(user1.address)).gte(shortToRedeem)
      // expect fee to be zero
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      expect(calculateFee(totalOwed, await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY))).eq(0)

      await expect(
        prePOMarket.connect(user1).redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'FeeRoundsToZero')
    })

    it('reverts if amounts > 0, fee amount = 0, fee > 0%, and redeeming more long', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).lte(parseEther('1'))
      expect(await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY)).gt(0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const shortToRedeem = BigNumber.from(2)
      const longToRedeem = BigNumber.from(99998).sub(shortToRedeem)
      expect(await longToken.balanceOf(user1.address)).gte(longToRedeem)
      expect(await shortToken.balanceOf(user1.address)).gte(shortToRedeem)
      // expect fee to be zero
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      expect(calculateFee(totalOwed, await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY))).eq(0)

      await expect(
        prePOMarket.connect(user1).redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'FeeRoundsToZero')
    })

    it('reverts if amounts > 0, fee amount = 0, fee > 0%, and redeeming more short', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).lte(parseEther('1'))
      expect(await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY)).gt(0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const longToRedeem = BigNumber.from(2)
      const shortToRedeem = BigNumber.from(99998).sub(longToRedeem)
      expect(await longToken.balanceOf(user1.address)).gte(longToRedeem)
      expect(await shortToken.balanceOf(user1.address)).gte(shortToRedeem)
      // expect fee to be zero
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      expect(calculateFee(totalOwed, await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY))).eq(0)

      await expect(
        prePOMarket.connect(user1).redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'FeeRoundsToZero')
    })

    it('retrieves hook with correct key if address beacon set', async () => {
      expect(await prePOMarket.getAddressBeacon()).eq(mockAddressBeacon.address)

      await prePOMarket
        .connect(user1)
        .redeem(TEST_MINT_AMOUNT, TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(mockAddressBeacon.get).calledWith(REDEEM_HOOK_KEY)
    })

    it('retrieves fee with correct key if uint beacon set', async () => {
      expect(await prePOMarket.getUintBeacon()).eq(mockUintBeacon.address)

      await prePOMarket
        .connect(user1)
        .redeem(TEST_MINT_AMOUNT, TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      expect(mockUintBeacon.get).calledWith(REDEEM_FEE_PERCENT_KEY)
    })

    it('should not allow long token redemption exceeding long token balance', async () => {
      await expect(
        prePOMarket
          .connect(user1)
          .redeem(TEST_MINT_AMOUNT.add(1), TEST_MINT_AMOUNT, user1.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'InsufficientLongToken')
    })

    it('should not allow short token redemption exceeding short token balance', async () => {
      await expect(
        prePOMarket
          .connect(user1)
          .redeem(TEST_MINT_AMOUNT, TEST_MINT_AMOUNT.add(1), user1.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'InsufficientShortToken')
    })

    it('should only allow token redemption in equal parts before expiry', async () => {
      await expect(
        prePOMarket
          .connect(user1)
          .redeem(TEST_MINT_AMOUNT, TEST_MINT_AMOUNT.sub(1), user1.address, JUNK_PAYLOAD)
      ).revertedWithCustomError(prePOMarket, 'UnequalRedemption')
    })

    it('should correctly settle equal non-zero redemption amounts before market end', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = TEST_MINT_AMOUNT
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      expect(await longToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user1.address)).eq(totalOwed)
    })

    it('redeems if funder != recipient and market not ended', async () => {
      expect(user1.address).not.eq(user2.address)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = TEST_MINT_AMOUNT
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user2.address, JUNK_PAYLOAD)

      expect(await longToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user2.address)).eq(totalOwed)
    })

    it('should correctly settle non-equal non-zero redemption amounts after market end', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = TEST_MINT_AMOUNT.sub(1)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      expect(await longToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user1.address)).eq(totalOwed)
    })

    it('should correctly settle redemption done with only long tokens after market end', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = parseEther('0')
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      expect(await longToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user1.address)).eq(totalOwed)
    })

    it('should correctly settle redemption done with only short tokens after market end', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = parseEther('0')
      const shortToRedeem = TEST_MINT_AMOUNT
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      expect(await longToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user1.address)).eq(totalOwed)
    })

    it("doesn't burn short tokens if only long tokens redeemed", async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = parseEther('0')

      const tx = await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      await expect(tx).not.emit(shortToken, 'Transfer')
    })

    it("doesn't burn long tokens if only short tokens redeemed", async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = parseEther('0')
      const shortToRedeem = TEST_MINT_AMOUNT

      const tx = await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      await expect(tx).not.emit(longToken, 'Transfer')
    })

    it('redeems if funder != recipient and market ended', async () => {
      expect(user1.address).not.eq(user2.address)
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = TEST_MINT_AMOUNT
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user2.address, JUNK_PAYLOAD)

      const filter = prePOMarket.filters.Redemption(user1.address, user2.address)
      const events = await prePOMarket.queryFilter(filter)
      const event = events[0].args
      expect(event.funder).eq(user1.address)
      expect(event.recipient).eq(user2.address)
      expect(event.amountAfterFee).eq(totalOwed)
      expect(event.fee).eq(0)
      expect(await longToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user2.address)).eq(totalOwed)
    })

    it('allows amounts > 0 if fee = 0% and redeeming equal parts', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      await mockUintBeacon.connect(deployer).set(REDEEM_FEE_PERCENT_KEY, 0)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      expect(await longToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user1.address)).eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user1.address)).eq(totalOwed)
    })

    it('allows amounts > 0 if fee = 0% and redeeming more long', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).lte(parseEther('1'))
      await mockUintBeacon.connect(deployer).set(REDEEM_FEE_PERCENT_KEY, 0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const shortToRedeem = BigNumber.from(2)
      const longToRedeem = BigNumber.from(99998).sub(shortToRedeem)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      const longBefore = await longToken.balanceOf(user1.address)
      const shortBefore = await shortToken.balanceOf(user1.address)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      expect(await longToken.balanceOf(user1.address)).eq(longBefore.sub(longToRedeem))
      expect(await shortToken.balanceOf(user1.address)).eq(shortBefore.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user1.address)).eq(totalOwed)
    })

    it('allows amounts > 0 if fee = 0% and redeeming more short', async () => {
      await prePOMarket.connect(deployer).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).lte(parseEther('1'))
      await mockUintBeacon.connect(deployer).set(REDEEM_FEE_PERCENT_KEY, 0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const longToRedeem = BigNumber.from(2)
      const shortToRedeem = BigNumber.from(99998).sub(longToRedeem)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      const longBefore = await longToken.balanceOf(user1.address)
      const shortBefore = await shortToken.balanceOf(user1.address)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      expect(await longToken.balanceOf(user1.address)).eq(longBefore.sub(longToRedeem))
      expect(await shortToken.balanceOf(user1.address)).eq(shortBefore.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user1.address)).eq(totalOwed)
    })

    it("doesn't approve fee if hook not set", async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      await mockAddressBeacon.connect(deployer).set(REDEEM_HOOK_KEY, ZERO_ADDRESS)

      const tx = await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      await expect(tx).not.emit(collateralToken, 'Approval')
      expect(await collateralToken.allowance(prePOMarket.address, redeemHook.address)).eq(0)
    })

    it("doesn't approve fee if fee percent = 0%", async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      await mockUintBeacon.connect(deployer).set(REDEEM_FEE_PERCENT_KEY, 0)

      const tx = await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      await expect(tx).not.emit(collateralToken, 'Approval')
    })

    it('approves fee for hook to use', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      const redeemFee = calculateFee(totalOwed, await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY))
      expect(redeemFee).gt(0)

      const tx = await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      await expect(tx)
        .emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, redeemFee)
    })

    it('sets approval back to 0', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      const redeemFee = calculateFee(totalOwed, await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY))
      expect(redeemFee).gt(0)

      const tx = await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      await expect(tx)
        .emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, redeemFee)
      await expect(tx)
        .emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, 0)
      expect(await collateralToken.allowance(prePOMarket.address, redeemHook.address)).eq(0)
    })

    it('sends correct collateral amount if hook takes full fee', async () => {
      const allowList = await fakeAccountListFixture()
      const tokenSender = await fakeTokenSenderFixture()
      const testRedeemHook = await marketHookFixture()
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const funderCTBefore = await collateralToken.balanceOf(user1.address)
      const recipientCTBefore = await collateralToken.balanceOf(user2.address)
      const treasuryCTBefore = await collateralToken.balanceOf(governance.address)
      await testRedeemHook.connect(deployer).setTreasury(governance.address)
      await testRedeemHook.connect(deployer).setTokenSender(tokenSender.address)
      await mockAddressBeacon.connect(deployer).set(REDEEM_HOOK_KEY, testRedeemHook.address)
      allowList.isIncluded.whenCalledWith(user1.address).returns(true)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      const redeemFee = calculateFee(totalOwed, await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY))
      expect(redeemFee).gt(0)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user2.address, JUNK_PAYLOAD)

      const filter = prePOMarket.filters.Redemption(user1.address, user2.address)
      const events = await prePOMarket.queryFilter(filter)
      const event = events[0].args
      expect(event.funder).eq(user1.address)
      expect(event.recipient).eq(user2.address)
      expect(event.amountAfterFee).eq(TEST_MINT_AMOUNT.sub(redeemFee))
      expect(event.fee).eq(redeemFee)
      expect(await collateralToken.balanceOf(user1.address)).eq(funderCTBefore)
      expect(await collateralToken.balanceOf(user2.address)).eq(
        recipientCTBefore.add(totalOwed.sub(redeemFee))
      )
      expect(await collateralToken.balanceOf(governance.address)).eq(
        treasuryCTBefore.add(redeemFee)
      )
    })

    it('sends correct collateral amount if hook takes partial fee', async () => {
      // TestMarketHook meant to take 50% of the fee
      const factory = await ethers.getContractFactory('TestMarketHook')
      const testRedeemHook = await factory.connect(deployer).deploy(governance.address, 500000)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const funderCTBefore = await collateralToken.balanceOf(user1.address)
      const recipientCTBefore = await collateralToken.balanceOf(user2.address)
      const treasuryCTBefore = await collateralToken.balanceOf(governance.address)
      await mockAddressBeacon.connect(deployer).set(REDEEM_HOOK_KEY, testRedeemHook.address)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      const redeemFee = calculateFee(totalOwed, await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY))
      expect(redeemFee).gt(0)
      const expectedPartialFee = redeemFee.div(2)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user2.address, JUNK_PAYLOAD)

      const filter = prePOMarket.filters.Redemption(user1.address, user2.address)
      const events = await prePOMarket.queryFilter(filter)
      const event = events[0].args
      expect(event.funder).eq(user1.address)
      expect(event.recipient).eq(user2.address)
      expect(event.amountAfterFee).eq(TEST_MINT_AMOUNT.sub(expectedPartialFee))
      expect(event.fee).eq(expectedPartialFee)
      expect(await collateralToken.balanceOf(user1.address)).eq(funderCTBefore)
      expect(await collateralToken.balanceOf(user2.address)).eq(
        recipientCTBefore.add(totalOwed.sub(expectedPartialFee))
      )
      expect(await collateralToken.balanceOf(governance.address)).eq(
        treasuryCTBefore.add(expectedPartialFee)
      )
    })

    it('sends full collateral amount if hook takes no fee', async () => {
      // TestMarketHook meant to take 0% of the fee
      const factory = await ethers.getContractFactory('TestMarketHook')
      const testRedeemHook = await factory.connect(deployer).deploy(governance.address, 0)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const funderCTBefore = await collateralToken.balanceOf(user1.address)
      const recipientCTBefore = await collateralToken.balanceOf(user2.address)
      const treasuryCTBefore = await collateralToken.balanceOf(governance.address)
      await mockAddressBeacon.connect(deployer).set(REDEEM_HOOK_KEY, testRedeemHook.address)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user2.address, JUNK_PAYLOAD)

      const filter = prePOMarket.filters.Redemption(user1.address, user2.address)
      const events = await prePOMarket.queryFilter(filter)
      const event = events[0].args
      expect(event.funder).eq(user1.address)
      expect(event.recipient).eq(user2.address)
      expect(event.amountAfterFee).eq(TEST_MINT_AMOUNT)
      expect(event.fee).eq(0)
      expect(await collateralToken.balanceOf(user1.address)).eq(funderCTBefore)
      expect(await collateralToken.balanceOf(user2.address)).eq(recipientCTBefore.add(totalOwed))
      expect(await collateralToken.balanceOf(governance.address)).eq(treasuryCTBefore)
    })

    it('sends full collateral amount if hook not set', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const funderCTBefore = await collateralToken.balanceOf(user1.address)
      const recipientCTBefore = await collateralToken.balanceOf(user2.address)
      const treasuryCTBefore = await collateralToken.balanceOf(governance.address)
      await mockAddressBeacon.connect(deployer).set(REDEEM_HOOK_KEY, ZERO_ADDRESS)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      const redeemFee = calculateFee(totalOwed, await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY))
      expect(redeemFee).gt(0)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user2.address, JUNK_PAYLOAD)

      expect(await collateralToken.balanceOf(user1.address)).eq(funderCTBefore)
      expect(await collateralToken.balanceOf(user2.address)).eq(recipientCTBefore.add(totalOwed))
      expect(await collateralToken.balanceOf(governance.address)).eq(treasuryCTBefore)
    })

    it('ignores hook if not set', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      await mockAddressBeacon.connect(deployer).set(REDEEM_HOOK_KEY, ZERO_ADDRESS)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      expect(redeemHook['hook(address,address,uint256,uint256,bytes)']).not.called
    })

    it('calls hook with correct parameters and redeemer = recipient', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      const redeemFee = calculateFee(totalOwed, await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY))
      expect(redeemFee).gt(0)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user1.address, JUNK_PAYLOAD)

      expect(redeemHook['hook(address,address,uint256,uint256,bytes)']).calledWith(
        user1.address,
        user1.address,
        totalOwed,
        totalOwed.sub(redeemFee),
        JUNK_PAYLOAD
      )
    })

    it('calls hook with correct parameters if redeemer != recipient', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).gt(0)
      const redeemFee = calculateFee(totalOwed, await mockUintBeacon.get(REDEEM_FEE_PERCENT_KEY))
      expect(redeemFee).gt(0)

      await prePOMarket
        .connect(user1)
        .redeem(longToRedeem, shortToRedeem, user2.address, JUNK_PAYLOAD)

      expect(redeemHook['hook(address,address,uint256,uint256,bytes)']).calledWith(
        user1.address,
        user2.address,
        totalOwed,
        totalOwed.sub(redeemFee),
        JUNK_PAYLOAD
      )
    })

    it('emits Redemption indexed by redeemer', async () => {
      // redeem expected to not take any fee
      await prePOMarket
        .connect(user1)
        .redeem(TEST_MINT_AMOUNT, TEST_MINT_AMOUNT, user2.address, JUNK_PAYLOAD)

      const filter = prePOMarket.filters.Redemption(user1.address, user2.address)
      const events = await prePOMarket.queryFilter(filter)
      const event = events[0].args
      expect(event.funder).eq(user1.address)
      expect(event.recipient).eq(user2.address)
      expect(event.amountAfterFee).eq(TEST_MINT_AMOUNT)
      expect(event.fee).eq(0)
    })

    afterEach(() => {
      redeemHook['hook(address,address,uint256,uint256,bytes)'].reset()
      mockUintBeacon.get.reset()
      mockAddressBeacon.get.reset()
    })
  })
})
