import { parseEther } from '@ethersproject/units'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ZERO_ADDRESS } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { LongShortToken } from '../../types/generated'
import { LongShortTokenFixture } from '../fixtures/LongShortTokenFixture'

const { generateDomainSeparator } = utils

describe('=> LongShortToken', () => {
  let longShort: LongShortToken
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  const TEST_AMOUNT = parseEther('1')
  const TEST_NAME = 'Long Fake Token ($5-10B)'
  const TEST_SYMBOL = 'L_FAKE_5-10B'

  beforeEach(async () => {
    ;[deployer, user, user2] = await ethers.getSigners()
    longShort = await LongShortTokenFixture(TEST_NAME, TEST_SYMBOL)
  })

  describe('# initialize', () => {
    it('should be initialized with correct values', async () => {
      expect(await longShort.name()).to.eq(TEST_NAME)
      expect(await longShort.symbol()).to.eq(TEST_SYMBOL)
    })

    it('owner should be set to deployer', async () => {
      expect(await longShort.owner()).to.eq(deployer.address)
    })

    it('generates domain separator from token name', async () => {
      /**
       * Domain separator is generated using the chainId accessed via
       * `block.chainid`. It seems that the hardhat test network will return
       * 0 for the chainId when accessed in-contract via `block.chainid`, even
       * though the network provider designates 31337 for hardhat networks.
       */
      expect(await longShort.DOMAIN_SEPARATOR()).to.eq(
        generateDomainSeparator(TEST_NAME, '1', 31337, longShort.address)
      )
    })
  })

  describe('# mint', () => {
    it('should only usable by the owner', async () => {
      await expect(longShort.connect(user).mint(user.address, 1)).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
    it('should allow the owner to mint tokens for another user', async () => {
      await longShort.connect(deployer).mint(user.address, 1)
      expect(await longShort.balanceOf(user.address)).to.eq(1)
    })
    it('should allow the owner to mint tokens for themselves', async () => {
      await longShort.connect(deployer).mint(deployer.address, 1)
      expect(await longShort.balanceOf(deployer.address)).to.eq(1)
    })
  })

  describe('# burnFrom', () => {
    beforeEach(async () => {
      await longShort.connect(deployer).mint(user.address, TEST_AMOUNT)
    })

    it('allows token contract owner to burn user tokens without approval', async () => {
      const userBalanceBefore = await longShort.balanceOf(user.address)
      const totalSupplyBefore = await longShort.totalSupply()
      await longShort.connect(user).approve(deployer.address, 0)

      const tx = await longShort.connect(deployer).burnFrom(user.address, TEST_AMOUNT)

      await expect(tx).emit(longShort, 'Transfer').withArgs(user.address, ZERO_ADDRESS, TEST_AMOUNT)
      expect(await longShort.balanceOf(user.address)).eq(userBalanceBefore.sub(TEST_AMOUNT))
      expect(await longShort.totalSupply()).eq(totalSupplyBefore.sub(TEST_AMOUNT))
    })

    it('reverts if insufficient allowance and burner != owner', async () => {
      expect(user2.address).not.eq(await longShort.owner())
      expect(await longShort.allowance(user2.address, user.address)).lt(TEST_AMOUNT)

      await expect(longShort.connect(user2).burnFrom(user.address, TEST_AMOUNT)).to.revertedWith(
        'ERC20: insufficient allowance'
      )
    })
  })
})
