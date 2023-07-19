import { ethers } from 'hardhat'
import { PausableTest } from '../../types/generated'

export async function pausableTestFixture(): Promise<PausableTest> {
  const factory = await ethers.getContractFactory('PausableTest')
  return (await factory.deploy()) as PausableTest
}
