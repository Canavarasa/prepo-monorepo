import { ethers } from 'hardhat'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { TreasuryCaller } from '../../types/generated'

export async function treasuryCallerFixture(): Promise<TreasuryCaller> {
  const factory = await ethers.getContractFactory('TreasuryCaller')
  return (await factory.deploy()) as TreasuryCaller
}

export async function fakeTreasuryCallerFixture(): Promise<FakeContract> {
  const fakeContract = await smock.fake('TreasuryCaller')
  return fakeContract
}
