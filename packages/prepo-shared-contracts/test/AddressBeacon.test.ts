import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { id } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { JUNK_ADDRESS, ZERO_ADDRESS } from 'prepo-constants'
import { addressBeaconFixture } from './fixtures/BeaconFixtures'
import { AddressBeacon } from '../types/generated'

describe('AddressBeacon', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let addressBeacon: AddressBeacon
  const TEST_KEY = id('TEST_KEY')

  const setupAddressBeacon = async (): Promise<void> => {
    ;[deployer, user1] = await ethers.getSigners()
    owner = deployer
    addressBeacon = await addressBeaconFixture()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupAddressBeacon()
    })

    it('sets owner to deployer', async () => {
      expect(await addressBeacon.owner()).eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await addressBeacon.getNominee()).eq(ZERO_ADDRESS)
    })
  })

  describe('# set', () => {
    beforeEach(async () => {
      await setupAddressBeacon()
    })

    it('reverts if not owner', async () => {
      expect(await addressBeacon.owner()).not.eq(user1.address)

      await expect(addressBeacon.connect(user1).set(TEST_KEY, JUNK_ADDRESS)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await addressBeacon.get(TEST_KEY)).eq(ZERO_ADDRESS)

      await addressBeacon.connect(owner).set(TEST_KEY, JUNK_ADDRESS)

      expect(await addressBeacon.get(TEST_KEY)).eq(JUNK_ADDRESS)
    })

    it('sets to zero address', async () => {
      await addressBeacon.connect(owner).set(TEST_KEY, JUNK_ADDRESS)
      expect(await addressBeacon.get(TEST_KEY)).not.eq(ZERO_ADDRESS)

      await addressBeacon.connect(owner).set(TEST_KEY, ZERO_ADDRESS)

      expect(await addressBeacon.get(TEST_KEY)).eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await addressBeacon.get(TEST_KEY)).not.eq(JUNK_ADDRESS)

      await addressBeacon.connect(owner).set(TEST_KEY, JUNK_ADDRESS)

      expect(await addressBeacon.get(TEST_KEY)).eq(JUNK_ADDRESS)

      await addressBeacon.connect(owner).set(TEST_KEY, JUNK_ADDRESS)

      expect(await addressBeacon.get(TEST_KEY)).eq(JUNK_ADDRESS)
    })

    it('emits AddressChange', async () => {
      const tx = await addressBeacon.connect(owner).set(TEST_KEY, JUNK_ADDRESS)

      await expect(tx)
        .emit(addressBeacon, 'AddressChange(bytes32,address)')
        .withArgs(TEST_KEY, JUNK_ADDRESS)
    })
  })
})
