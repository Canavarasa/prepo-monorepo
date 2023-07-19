import { ethers } from 'hardhat'
import { MockContract, smock } from '@defi-wonderland/smock'
import { TestERC20, TestERC20__factory } from '../../types/generated'

export async function testERC20Fixture(
  tokenName: string,
  tokenSymbol: string,
  decimals: number
): Promise<TestERC20> {
  const factory = await ethers.getContractFactory('TestERC20')
  return (await factory.deploy(tokenName, tokenSymbol, decimals)) as TestERC20
}

export async function smockTestERC20Fixture(
  tokenName: string,
  tokenSymbol: string,
  decimals: number
): Promise<MockContract<TestERC20>> {
  const mockFactory = await smock.mock<TestERC20__factory>('TestERC20')
  return mockFactory.deploy(tokenName, tokenSymbol, decimals)
}
