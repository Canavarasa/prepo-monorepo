import { ethers } from 'hardhat'
import { MockContract, FakeContract, smock } from '@defi-wonderland/smock'
import { TokenSender, TokenSender__factory } from '../../types/generated'

export async function tokenSenderFixture(outputToken, outputTokenDecimals): Promise<TokenSender> {
  const factory = await ethers.getContractFactory('TokenSender')
  return (await factory.deploy(outputToken, outputTokenDecimals)) as unknown as TokenSender
}

export async function smockTokenSenderFixture(
  outputToken,
  outputTokenDecimals
): Promise<MockContract<TokenSender>> {
  const mockFactory = await smock.mock<TokenSender__factory>('TokenSender')
  return mockFactory.deploy(outputToken, outputTokenDecimals)
}

export function fakeTokenSenderFixture(): Promise<FakeContract<TokenSender>> {
  return smock.fake<TokenSender>('TokenSender')
}
