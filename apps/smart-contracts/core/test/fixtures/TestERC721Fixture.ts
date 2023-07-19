import { ethers } from 'hardhat'
import { TestERC721 } from '../../types/generated'

export async function testERC721Fixture(
  tokenName: string,
  tokenSymbol: string
): Promise<TestERC721> {
  const factory = await ethers.getContractFactory('TestERC721')
  return (await factory.deploy(tokenName, tokenSymbol)) as TestERC721
}
