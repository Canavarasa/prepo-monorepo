import { ethers } from 'hardhat'
import { PeriodicAccountLimitsTest } from '../../types/generated'

export async function periodicAccountLimitsTestFixture(): Promise<PeriodicAccountLimitsTest> {
  const factory = await ethers.getContractFactory('PeriodicAccountLimitsTest')
  const contract = (await factory.deploy()) as PeriodicAccountLimitsTest
  await contract.deployed()
  return contract
}
