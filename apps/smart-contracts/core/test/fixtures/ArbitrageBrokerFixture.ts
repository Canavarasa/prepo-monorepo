import { ethers } from 'hardhat'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { ArbitrageBroker } from '../../types/generated'

export async function arbitrageBrokerFixture(
  collateral: string,
  swapRouter: string
): Promise<ArbitrageBroker> {
  const factory = await ethers.getContractFactory('ArbitrageBroker')
  return (await factory.deploy(collateral, swapRouter)) as ArbitrageBroker
}

export function fakeArbitrageBrokerFixture(): Promise<FakeContract<ArbitrageBroker>> {
  return smock.fake<ArbitrageBroker>('ArbitrageBroker')
}
