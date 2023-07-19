import { ethers } from 'hardhat'
import { MockContract, FakeContract, smock } from '@defi-wonderland/smock'
import {
  DepositHook,
  WithdrawHook,
  MarketHook,
  AccountList,
  AccountList__factory,
  DepositHook__factory,
  WithdrawHook__factory,
  MarketHook__factory,
} from '../../types/generated'

export async function depositHookFixture(): Promise<DepositHook> {
  const factory = await ethers.getContractFactory('DepositHook')
  return (await factory.deploy()) as DepositHook
}

export async function withdrawHookFixture(baseTokenDecimals: number): Promise<WithdrawHook> {
  const factory = await ethers.getContractFactory('WithdrawHook')
  return (await factory.deploy(baseTokenDecimals)) as WithdrawHook
}

export async function marketHookFixture(): Promise<MarketHook> {
  const factory = await ethers.getContractFactory('MarketHook')
  return (await factory.deploy()) as MarketHook
}

export async function smockDepositHookFixture(): Promise<MockContract<DepositHook>> {
  const mockFactory = await smock.mock<DepositHook__factory>('DepositHook')
  return mockFactory.deploy()
}

export async function smockWithdrawHookFixture(
  baseTokenDecimals: number
): Promise<MockContract<WithdrawHook>> {
  const mockFactory = await smock.mock<WithdrawHook__factory>('WithdrawHook')
  return mockFactory.deploy(baseTokenDecimals)
}

export async function smockMarketHookFixture(): Promise<MockContract<MarketHook>> {
  const mockFactory = await smock.mock<MarketHook__factory>('MarketHook')
  return mockFactory.deploy()
}

export async function smockAccountListFixture(): Promise<MockContract<AccountList>> {
  const mockFactory = await smock.mock<AccountList__factory>('AccountList')
  return mockFactory.deploy()
}

export function fakeAccountListFixture(): Promise<FakeContract<AccountList>> {
  return smock.fake<AccountList>('AccountList')
}

export function fakeDepositHookFixture(): Promise<FakeContract<DepositHook>> {
  return smock.fake<DepositHook>('DepositHook')
}

export function fakeWithdrawHookFixture(): Promise<FakeContract<WithdrawHook>> {
  return smock.fake<WithdrawHook>('WithdrawHook')
}

export function fakeMarketHookFixture(): Promise<FakeContract<MarketHook>> {
  return smock.fake<MarketHook>('MarketHook')
}
