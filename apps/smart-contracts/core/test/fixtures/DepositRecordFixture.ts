import { ethers } from 'hardhat'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { DepositRecord, DepositRecord__factory } from '../../types/generated'

export async function depositRecordFixture(): Promise<DepositRecord> {
  const factory = await ethers.getContractFactory('DepositRecord')
  return (await factory.deploy()) as DepositRecord
}

export async function smockDepositRecordFixture(): Promise<MockContract<DepositRecord>> {
  const mockFactory = await smock.mock<DepositRecord__factory>('DepositRecord')
  return mockFactory.deploy()
}

export function fakeDepositRecordFixture(): Promise<FakeContract<DepositRecord>> {
  return smock.fake<DepositRecord>('DepositRecord')
}
