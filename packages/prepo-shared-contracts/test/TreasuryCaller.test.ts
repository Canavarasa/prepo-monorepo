import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS } from 'prepo-constants'
import { treasuryCallerFixture } from './fixtures/TreasuryCallerFixtures'
import { TreasuryCaller } from '../types/generated'

chai.use(smock.matchers)

describe('=> TreasuryCaller', () => {
  let treasuryCaller: TreasuryCaller
  let deployer: SignerWithAddress
  let treasury: SignerWithAddress
  beforeEach(async () => {
    ;[deployer, treasury] = await ethers.getSigners()
    treasuryCaller = await treasuryCallerFixture()
  })

  describe('initial state', () => {
    it('does not set treasury', async () => {
      expect(await treasuryCaller.getTreasury()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setTreasury', () => {
    it('sets treasury to non-zero address', async () => {
      await treasuryCaller.connect(deployer).setTreasury(treasury.address)

      expect(await treasuryCaller.getTreasury()).to.eq(treasury.address)
    })

    it('sets treasury to zero address', async () => {
      await treasuryCaller.connect(deployer).setTreasury(ZERO_ADDRESS)

      expect(await treasuryCaller.getTreasury()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      await treasuryCaller.connect(deployer).setTreasury(treasury.address)
      expect(await treasuryCaller.getTreasury()).to.eq(treasury.address)

      await treasuryCaller.connect(deployer).setTreasury(treasury.address)

      expect(await treasuryCaller.getTreasury()).to.eq(treasury.address)
    })

    it('emits TreasuryChange event', async () => {
      await expect(treasuryCaller.connect(deployer).setTreasury(treasury.address))
        .to.emit(treasuryCaller, 'TreasuryChange')
        .withArgs(treasury.address)
    })
  })
})
