import { expect } from 'chai'
import { parseEther } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { ZERO_ADDRESS } from 'prepo-constants'
import { Create2Address, utils } from 'prepo-hardhat'
import { MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { testERC20Fixture } from '../fixtures/TestERC20Fixture'
import { LongShortTokenAttachFixture } from '../fixtures/LongShortTokenFixture'
import { prePOMarketAttachFixture } from '../fixtures/PrePOMarketFixture'
import { prePOMarketFactoryFixture } from '../fixtures/PrePOMarketFactoryFixture'
import { createMarket, generateLongShortSalts } from '../../helpers'
import { CreateMarketParams } from '../../types'
import { AddressBeacon, PrePOMarketFactory, TestERC20, UintBeacon } from '../../types/generated'
import { mockAddressBeaconFixture, mockUintBeaconFixture } from '../fixtures/BeaconFixtures'

const { nowPlusMonths } = utils

describe('=> PrePOMarketFactory', () => {
  let deployer: SignerWithAddress
  let treasury: SignerWithAddress
  let prePOMarketFactory: PrePOMarketFactory
  let collateralToken: TestERC20
  let mockAddressBeacon: MockContract<AddressBeacon>
  let mockUintBeacon: MockContract<UintBeacon>
  let salts: { longTokenSalt: Create2Address; shortTokenSalt: Create2Address }
  const TEST_NAME_SUFFIX = 'Fake Token ($5-10B)'
  const TEST_SYMBOL_SUFFIX = 'FAKE_5-10B'
  const TEST_FLOOR_VAL = 5
  const TEST_CEILING_VAL = 10
  const TEST_EXPIRY = nowPlusMonths(2)
  const TEST_FLOOR_PAYOUT = parseEther('0.2')
  const TEST_CEILING_PAYOUT = parseEther('0.8')
  const TEST_EXPIRY_PAYOUT = parseEther('0.5')
  const MOCK_COLLATERAL_SUPPLY = parseEther('1000000000')

  beforeEach(async () => {
    ;[deployer, treasury] = await ethers.getSigners()
    collateralToken = await testERC20Fixture('prePO USDC Collateral', 'preUSD', 18)
    await collateralToken.mint(deployer.address, MOCK_COLLATERAL_SUPPLY)
    prePOMarketFactory = await prePOMarketFactoryFixture()
    mockAddressBeacon = await mockAddressBeaconFixture()
    mockUintBeacon = await mockUintBeaconFixture()
    salts = await generateLongShortSalts(
      ethers,
      prePOMarketFactory.address,
      collateralToken.address,
      TEST_NAME_SUFFIX,
      TEST_SYMBOL_SUFFIX,
      utils.generateLowerAddress
    )
  })

  describe('# setAddressBeacon', () => {
    it('reverts if not owner', async () => {
      expect(await prePOMarketFactory.owner()).not.eq(treasury.address)

      await expect(
        prePOMarketFactory.connect(treasury).setAddressBeacon(mockAddressBeacon.address)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('sets to non-zero address', async () => {
      expect(await prePOMarketFactory.getAddressBeacon()).not.eq(mockAddressBeacon.address)

      await prePOMarketFactory.connect(deployer).setAddressBeacon(mockAddressBeacon.address)

      expect(await prePOMarketFactory.getAddressBeacon()).eq(mockAddressBeacon.address)
    })

    it('sets to zero address', async () => {
      await prePOMarketFactory.connect(deployer).setAddressBeacon(mockAddressBeacon.address)
      expect(await prePOMarketFactory.getAddressBeacon()).to.not.eq(ZERO_ADDRESS)

      await prePOMarketFactory.connect(deployer).setAddressBeacon(ZERO_ADDRESS)

      expect(await prePOMarketFactory.getAddressBeacon()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await prePOMarketFactory.getAddressBeacon()).to.not.eq(mockAddressBeacon.address)

      await prePOMarketFactory.connect(deployer).setAddressBeacon(mockAddressBeacon.address)

      expect(await prePOMarketFactory.getAddressBeacon()).to.eq(mockAddressBeacon.address)

      await prePOMarketFactory.connect(deployer).setAddressBeacon(mockAddressBeacon.address)

      expect(await prePOMarketFactory.getAddressBeacon()).to.eq(mockAddressBeacon.address)
    })

    it('emits AddressBeaconChange', async () => {
      const tx = await prePOMarketFactory
        .connect(deployer)
        .setAddressBeacon(mockAddressBeacon.address)

      await expect(tx)
        .to.emit(prePOMarketFactory, 'AddressBeaconChange')
        .withArgs(mockAddressBeacon.address)
    })
  })

  describe('# setUintBeacon', () => {
    it('reverts if not owner', async () => {
      expect(await prePOMarketFactory.owner()).not.eq(treasury.address)

      await expect(
        prePOMarketFactory.connect(treasury).setUintBeacon(mockUintBeacon.address)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('sets to non-zero address', async () => {
      expect(await prePOMarketFactory.getUintBeacon()).not.eq(mockUintBeacon.address)

      await prePOMarketFactory.connect(deployer).setUintBeacon(mockUintBeacon.address)

      expect(await prePOMarketFactory.getUintBeacon()).eq(mockUintBeacon.address)
    })

    it('sets to zero address', async () => {
      await prePOMarketFactory.connect(deployer).setUintBeacon(mockUintBeacon.address)
      expect(await prePOMarketFactory.getUintBeacon()).to.not.eq(ZERO_ADDRESS)

      await prePOMarketFactory.connect(deployer).setUintBeacon(ZERO_ADDRESS)

      expect(await prePOMarketFactory.getUintBeacon()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await prePOMarketFactory.getUintBeacon()).to.not.eq(mockUintBeacon.address)

      await prePOMarketFactory.connect(deployer).setUintBeacon(mockUintBeacon.address)

      expect(await prePOMarketFactory.getUintBeacon()).to.eq(mockUintBeacon.address)

      await prePOMarketFactory.connect(deployer).setUintBeacon(mockUintBeacon.address)

      expect(await prePOMarketFactory.getUintBeacon()).to.eq(mockUintBeacon.address)
    })

    it('emits UintBeaconChange', async () => {
      const tx = await prePOMarketFactory.connect(deployer).setUintBeacon(mockUintBeacon.address)

      await expect(tx)
        .to.emit(prePOMarketFactory, 'UintBeaconChange')
        .withArgs(mockUintBeacon.address)
    })
  })

  describe('# createMarket', () => {
    let defaultParams: CreateMarketParams
    beforeEach(async () => {
      defaultParams = {
        factory: prePOMarketFactory,
        tokenNameSuffix: TEST_NAME_SUFFIX,
        tokenSymbolSuffix: TEST_SYMBOL_SUFFIX,
        longTokenSalt: salts.longTokenSalt.salt,
        shortTokenSalt: salts.shortTokenSalt.salt,
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
      await prePOMarketFactory.connect(deployer).setAddressBeacon(mockAddressBeacon.address)
      await prePOMarketFactory.connect(deployer).setUintBeacon(mockUintBeacon.address)
    })

    it('reverts if address beacon not set', async () => {
      await prePOMarketFactory.connect(deployer).setAddressBeacon(ZERO_ADDRESS)

      const tx = createMarket(deployer, defaultParams)

      await expect(tx).revertedWithCustomError(prePOMarketFactory, 'AddressBeaconNotSet')
    })

    it('reverts if uint beacon not set', async () => {
      await prePOMarketFactory.connect(deployer).setUintBeacon(ZERO_ADDRESS)

      const tx = createMarket(deployer, defaultParams)

      await expect(tx).revertedWithCustomError(prePOMarketFactory, 'UintBeaconNotSet')
    })

    it('reverts if long token address > collateral', async () => {
      const { longTokenSalt } = await generateLongShortSalts(
        ethers,
        prePOMarketFactory.address,
        collateralToken.address,
        TEST_NAME_SUFFIX,
        TEST_SYMBOL_SUFFIX,
        utils.generateHigherAddress
      )
      defaultParams = {
        ...defaultParams,
        longTokenSalt: longTokenSalt.salt,
      }

      const tx = createMarket(deployer, defaultParams)

      await expect(tx).revertedWithCustomError(prePOMarketFactory, 'LongTokenAddressTooHigh')
    })

    it('reverts if short token address > collateral', async () => {
      const { shortTokenSalt } = await generateLongShortSalts(
        ethers,
        prePOMarketFactory.address,
        collateralToken.address,
        TEST_NAME_SUFFIX,
        TEST_SYMBOL_SUFFIX,
        utils.generateHigherAddress
      )
      defaultParams = {
        ...defaultParams,
        shortTokenSalt: shortTokenSalt.salt,
      }

      const tx = createMarket(deployer, defaultParams)

      await expect(tx).revertedWithCustomError(prePOMarketFactory, 'ShortTokenAddressTooHigh')
    })

    it('reverts if duplicate market', async () => {
      await createMarket(deployer, defaultParams)

      const tx = createMarket(deployer, defaultParams)

      await expect(tx).revertedWithoutReason()
    })

    it('should emit MarketCreation event on market creation', async () => {
      const createMarketResult = await createMarket(deployer, defaultParams)

      const prePOMarket = await prePOMarketAttachFixture(createMarketResult.market)
      const longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      const shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())
      await expect(createMarketResult.tx)
        .to.emit(prePOMarketFactory, 'MarketCreation')
        .withArgs(
          prePOMarket.address,
          deployer.address,
          longToken.address,
          shortToken.address,
          await prePOMarketFactory.getAddressBeacon(),
          await prePOMarketFactory.getUintBeacon(),
          Object.values(defaultParams.parameters)
        )
    })

    it('should deploy two LongShortToken contracts owned by the new prePOMarket', async () => {
      const prePOMarket = await prePOMarketAttachFixture(
        await createMarket(deployer, defaultParams)
      )
      const longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      const shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())

      expect(await longToken.owner()).to.eq(prePOMarket.address)
      expect(await shortToken.owner()).to.eq(prePOMarket.address)
      expect(await longToken.name()).to.eq(`LONG ${TEST_NAME_SUFFIX}`)
      expect(await shortToken.name()).to.eq(`SHORT ${TEST_NAME_SUFFIX}`)
      expect(await longToken.symbol()).to.eq(`L_${TEST_SYMBOL_SUFFIX}`)
      expect(await shortToken.symbol()).to.eq(`S_${TEST_SYMBOL_SUFFIX}`)
    })

    it('uses `longTokenSalt` to generate the Long token contract address', async () => {
      const prePOMarket = await prePOMarketAttachFixture(
        await createMarket(deployer, defaultParams)
      )
      const longShortTokenFactory = await ethers.getContractFactory('LongShortToken')
      const longTokenDeployTx = longShortTokenFactory.getDeployTransaction(
        `LONG ${defaultParams.tokenNameSuffix}`,
        `L_${defaultParams.tokenSymbolSuffix}`
      )
      const hashedInitCode = ethers.utils.keccak256(longTokenDeployTx.data)

      expect(await prePOMarket.getLongToken()).to.eq(
        ethers.utils.getCreate2Address(
          prePOMarketFactory.address,
          defaultParams.longTokenSalt,
          hashedInitCode
        )
      )
    })

    it('uses `shortTokenSalt` to generate the Short token contract address', async () => {
      const prePOMarket = await prePOMarketAttachFixture(
        await createMarket(deployer, defaultParams)
      )
      const longShortTokenFactory = await ethers.getContractFactory('LongShortToken')
      const shortTokenDeployTx = longShortTokenFactory.getDeployTransaction(
        `SHORT ${defaultParams.tokenNameSuffix}`,
        `S_${defaultParams.tokenSymbolSuffix}`
      )
      const hashedInitCode = ethers.utils.keccak256(shortTokenDeployTx.data)

      expect(await prePOMarket.getShortToken()).to.eq(
        ethers.utils.getCreate2Address(
          prePOMarketFactory.address,
          defaultParams.shortTokenSalt,
          hashedInitCode
        )
      )
    })

    it('should initialize a prePOMarket with the correct values', async () => {
      const prePOMarket = await prePOMarketAttachFixture(
        await createMarket(deployer, defaultParams)
      )
      const longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      const shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())

      expect(await prePOMarket.getCollateral()).to.eq(collateralToken.address)
      expect(await longToken.owner()).to.eq(prePOMarket.address)
      expect(await shortToken.owner()).to.eq(prePOMarket.address)
      expect(await prePOMarket.getFloorLongPayout()).to.eq(TEST_FLOOR_PAYOUT)
      expect(await prePOMarket.getCeilingLongPayout()).to.eq(TEST_CEILING_PAYOUT)
      expect(await prePOMarket.getExpiryLongPayout()).eq(TEST_EXPIRY_PAYOUT)
      expect(await prePOMarket.getExpiryTime()).eq(TEST_EXPIRY)
      expect(await prePOMarket.getAddressBeacon()).eq(mockAddressBeacon.address)
      expect(await prePOMarket.getUintBeacon()).eq(mockUintBeacon.address)
    })
  })
})
