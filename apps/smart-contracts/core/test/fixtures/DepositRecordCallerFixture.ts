import { ethers } from 'hardhat'
import { DepositRecordCaller } from '../../types/generated'

export async function depositRecordCallerFixture(): Promise<DepositRecordCaller> {
  const factory = await ethers.getContractFactory('DepositRecordCaller')
  return (await factory.deploy()) as DepositRecordCaller
}
