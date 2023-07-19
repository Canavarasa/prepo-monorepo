import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { smock } from '@defi-wonderland/smock'
import { PERCENT_UNIT, ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { tokenSenderCallerFixture } from './fixtures/TokenSenderCallerFixtures'
import { TokenSenderCaller } from '../types/generated'

chai.use(smock.matchers)

describe('=> TokenSenderCaller', () => {
  let tokenSenderCaller: TokenSenderCaller
  let deployer: SignerWithAddress
  let tokenSender: SignerWithAddress

  beforeEach(async () => {
    ;[deployer, tokenSender] = await ethers.getSigners()
    tokenSenderCaller = await tokenSenderCallerFixture()
  })

  describe('initial state', () => {
    it("doesn't set TokenSender", async () => {
      expect(await tokenSenderCaller.getTokenSender()).eq(ZERO_ADDRESS)
    })

    it('sets PERCENT_UNIT constant', async () => {
      expect(await tokenSenderCaller.PERCENT_UNIT()).eq(PERCENT_UNIT)
    })
  })

  describe('# setAmountMultiplier', () => {
    it('sets to non-zero value < PERCENT_UNIT', async () => {
      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).eq(0)

      await tokenSenderCaller.connect(deployer).setAmountMultiplier(JUNK_ADDRESS, 1)

      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).eq(1)
    })

    it('sets to PERCENT_UNIT', async () => {
      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).not.eq(PERCENT_UNIT)

      await tokenSenderCaller.connect(deployer).setAmountMultiplier(JUNK_ADDRESS, PERCENT_UNIT)

      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).eq(PERCENT_UNIT)
    })

    it('sets to > PERCENT_UNIT', async () => {
      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).not.gt(PERCENT_UNIT)

      await tokenSenderCaller.connect(deployer).setAmountMultiplier(JUNK_ADDRESS, PERCENT_UNIT + 1)

      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).eq(PERCENT_UNIT + 1)
    })

    it('sets to non-zero', async () => {
      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).eq(0)

      await tokenSenderCaller.connect(deployer).setAmountMultiplier(JUNK_ADDRESS, 1)

      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).eq(1)
    })

    it('sets to 0', async () => {
      await tokenSenderCaller.connect(deployer).setAmountMultiplier(JUNK_ADDRESS, 1)
      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).not.eq(0)

      await tokenSenderCaller.connect(deployer).setAmountMultiplier(JUNK_ADDRESS, 0)

      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).eq(0)
    })

    it('is idempotent', async () => {
      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).not.eq(1)

      await tokenSenderCaller.connect(deployer).setAmountMultiplier(JUNK_ADDRESS, 1)

      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).eq(1)

      await tokenSenderCaller.connect(deployer).setAmountMultiplier(JUNK_ADDRESS, 1)

      expect(await tokenSenderCaller.getAmountMultiplier(JUNK_ADDRESS)).eq(1)
    })

    it('emits AmountMultiplierChange', async () => {
      await expect(tokenSenderCaller.connect(deployer).setAmountMultiplier(JUNK_ADDRESS, 1))
        .to.emit(tokenSenderCaller, 'AmountMultiplierChange')
        .withArgs(JUNK_ADDRESS, 1)
    })
  })

  describe('# setTokenSender', () => {
    it('sets non-zero address', async () => {
      await tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address)

      expect(await tokenSenderCaller.getTokenSender()).to.eq(tokenSender.address)
    })

    it('sets zero address', async () => {
      await tokenSenderCaller.connect(deployer).setTokenSender(ZERO_ADDRESS)

      expect(await tokenSenderCaller.getTokenSender()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      await tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address)
      expect(await tokenSenderCaller.getTokenSender()).to.eq(tokenSender.address)

      await tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address)

      expect(await tokenSenderCaller.getTokenSender()).to.eq(tokenSender.address)
    })

    it('emits TokenSenderChange', async () => {
      await expect(tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address))
        .to.emit(tokenSenderCaller, 'TokenSenderChange')
        .withArgs(tokenSender.address)
    })
  })
})
