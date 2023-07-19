import { ethers } from 'hardhat'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { Create2Address } from 'prepo-hardhat'
import { Create2Deployer, LongShortToken, LongShortToken__factory } from '../../types/generated'

export async function LongShortTokenFixture(
  tokenName: string,
  tokenSymbol: string
): Promise<LongShortToken> {
  const factory = await ethers.getContractFactory('LongShortToken')
  return (await factory.deploy(tokenName, tokenSymbol)) as LongShortToken
}

export async function LongShortTokenAttachFixture(tokenAddress: string): Promise<LongShortToken> {
  const factory = await ethers.getContractFactory('LongShortToken')
  return factory.attach(tokenAddress) as LongShortToken
}

export async function create2LongShortTokenFixture(
  tokenName: string,
  tokenSymbol: string,
  deployerFactory: Create2Deployer,
  create2Address: Create2Address
): Promise<LongShortToken> {
  const factory = await ethers.getContractFactory('LongShortToken')
  const deployTx = factory.getDeployTransaction(tokenName, tokenSymbol)
  const initCode = deployTx.data
  await deployerFactory.deploy(initCode, create2Address.salt)
  return LongShortTokenAttachFixture(create2Address.address)
}

export async function smockLongShortTokenFixture(
  tokenName: string,
  tokenSymbol: string
): Promise<MockContract<LongShortToken>> {
  const mockFactory = await smock.mock<LongShortToken__factory>('LongShortToken')
  return mockFactory.deploy(tokenName, tokenSymbol)
}

export function fakeLongShortTokenFixture(): Promise<FakeContract<LongShortToken>> {
  return smock.fake<LongShortToken>('LongShortToken')
}
