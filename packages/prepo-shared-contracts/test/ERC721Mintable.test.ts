import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { smock } from '@defi-wonderland/smock'
import { erc721MintableFixture } from './fixtures/ERC721MintableFixture'
import { ERC721Mintable } from '../types/generated'

chai.use(smock.matchers)

describe('=> ERC721Mintable', () => {
  const TOKEN_NAME = 'ERC721Mintable'
  const TOKEN_SYMBOL = 'TEST'
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let erc721Mintable: ERC721Mintable

  beforeEach(async () => {
    ;[deployer, user] = await ethers.getSigners()
    erc721Mintable = await erc721MintableFixture(TOKEN_NAME, TOKEN_SYMBOL)
  })

  describe('# initialize', () => {
    it('sets token name', async () => {
      expect(await erc721Mintable.name()).eq(TOKEN_NAME)
    })
    it('sets token symbol', async () => {
      expect(await erc721Mintable.symbol()).eq(TOKEN_SYMBOL)
    })
    it('sets owner to deployer', async () => {
      expect(await erc721Mintable.owner()).eq(deployer.address)
    })
  })

  describe('# mint', () => {
    it('reverts if not owner', async () => {
      expect(await erc721Mintable.owner()).not.eq(user.address)

      await expect(erc721Mintable.connect(user).mint(user.address, 1)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('reverts if token id already minted', async () => {
      await erc721Mintable.connect(deployer).mint(user.address, 1)
      expect(await erc721Mintable.ownerOf(1)).eq(user.address)

      await expect(erc721Mintable.connect(deployer).mint(user.address, 1)).revertedWith(
        'ERC721: token already minted'
      )
    })

    it('mints an NFT', async () => {
      await erc721Mintable.connect(deployer).mint(user.address, 1)

      expect(await erc721Mintable.balanceOf(user.address)).eq(1)
    })

    it('mints the specified token id', async () => {
      await erc721Mintable.connect(deployer).mint(user.address, 1)

      expect(await erc721Mintable.ownerOf(1)).eq(user.address)
    })
  })
})
