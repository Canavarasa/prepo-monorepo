import { ethers } from 'hardhat'
import { ERC721Mintable } from '../../types/generated'

export async function erc721MintableFixture(name: string, symbol: string): Promise<ERC721Mintable> {
  const factory = await ethers.getContractFactory('ERC721Mintable')
  return (await factory.deploy(name, symbol)) as ERC721Mintable
}
