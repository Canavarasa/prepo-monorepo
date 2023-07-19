import { BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import { Vesting, MockVestingClaimer } from '../../types/generated'

export async function vestingFixture(
  tokenAddress: string,
  vestingStartTime: BigNumberish,
  vestingEndTime: BigNumberish
): Promise<Vesting> {
  const factory = await ethers.getContractFactory('Vesting')
  return (await factory.deploy(
    tokenAddress,
    vestingStartTime,
    vestingEndTime
  )) as unknown as Vesting
}

export async function mockVestingClaimerFixture(
  vestingAddress: string
): Promise<MockVestingClaimer> {
  const Factory = await ethers.getContractFactory('MockVestingClaimer')
  return (await Factory.deploy(vestingAddress)) as unknown as MockVestingClaimer
}
