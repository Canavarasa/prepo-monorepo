import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { id } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { ZERO_ADDRESS } from 'prepo-constants'
import { uintBeaconFixture } from './fixtures/BeaconFixtures'
import { UintBeacon } from '../types/generated'

describe('UintBeacon', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let uintBeacon: UintBeacon
  const TEST_KEY = id('TEST_KEY')
  const TEST_VALUE = 12345

  const setupUintBeacon = async (): Promise<void> => {
    ;[deployer, user1] = await ethers.getSigners()
    owner = deployer
    uintBeacon = await uintBeaconFixture()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupUintBeacon()
    })

    it('sets owner to deployer', async () => {
      expect(await uintBeacon.owner()).eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await uintBeacon.getNominee()).eq(ZERO_ADDRESS)
    })
  })

  describe('# set', () => {
    beforeEach(async () => {
      await setupUintBeacon()
    })

    it('reverts if not owner', async () => {
      expect(await uintBeacon.owner()).not.eq(user1.address)

      await expect(uintBeacon.connect(user1).set(TEST_KEY, TEST_VALUE)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero value', async () => {
      expect(await uintBeacon.get(TEST_KEY)).eq(0)

      await uintBeacon.connect(owner).set(TEST_KEY, TEST_VALUE)

      expect(await uintBeacon.get(TEST_KEY)).eq(TEST_VALUE)
    })

    it('sets to zero', async () => {
      await uintBeacon.connect(owner).set(TEST_KEY, TEST_VALUE)
      expect(await uintBeacon.get(TEST_KEY)).not.eq(0)

      await uintBeacon.connect(owner).set(TEST_KEY, 0)

      expect(await uintBeacon.get(TEST_KEY)).eq(0)
    })

    it('is idempotent', async () => {
      expect(await uintBeacon.get(TEST_KEY)).not.eq(TEST_VALUE)

      await uintBeacon.connect(owner).set(TEST_KEY, TEST_VALUE)

      expect(await uintBeacon.get(TEST_KEY)).eq(TEST_VALUE)

      await uintBeacon.connect(owner).set(TEST_KEY, TEST_VALUE)

      expect(await uintBeacon.get(TEST_KEY)).eq(TEST_VALUE)
    })

    it('emits UintChange', async () => {
      const tx = await uintBeacon.connect(owner).set(TEST_KEY, TEST_VALUE)

      await expect(tx)
        .emit(uintBeacon, 'UintChange(bytes32,uint256)')
        .withArgs(TEST_KEY, TEST_VALUE)
    })
  })
})
