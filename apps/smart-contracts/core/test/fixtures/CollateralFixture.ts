import { ethers, upgrades } from 'hardhat'
import { MockContract, FakeContract, smock } from '@defi-wonderland/smock'
import { Collateral, Collateral__factory } from '../../types/generated'

export async function collateralFixture(
  name: string,
  symbol: string,
  baseToken: string,
  baseTokenDecimals: number
): Promise<Collateral> {
  const Factory = await ethers.getContractFactory('Collateral')
  return (await upgrades.deployProxy(Factory, [name, symbol], {
    unsafeAllow: ['constructor', 'state-variable-immutable'],
    constructorArgs: [baseToken, baseTokenDecimals],
  })) as Collateral
}

export async function smockCollateralFixture(
  name: string,
  symbol: string,
  baseToken: string,
  baseTokenDecimals: number
): Promise<MockContract<Collateral>> {
  const mockFactory = await smock.mock<Collateral__factory>('Collateral')
  const mockContract = await mockFactory.deploy(baseToken, baseTokenDecimals)
  await mockContract.initialize(name, symbol)
  return mockContract
}

export function fakeCollateralFixture(): Promise<FakeContract<Collateral>> {
  return smock.fake<Collateral>('Collateral')
}
