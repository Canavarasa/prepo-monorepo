import { ethers } from 'hardhat'
import { MockContract, smock } from '@defi-wonderland/smock'
import {
  UintBeacon,
  AddressBeacon,
  UintBeacon__factory,
  AddressBeacon__factory,
} from '../../types/generated'

export async function uintBeaconFixture(): Promise<UintBeacon> {
  const Factory = await ethers.getContractFactory('UintBeacon')
  return (await Factory.deploy()) as UintBeacon
}

export async function mockUintBeaconFixture(): Promise<MockContract<UintBeacon>> {
  const mockFactory = await smock.mock<UintBeacon__factory>('UintBeacon')
  return mockFactory.deploy()
}

export async function addressBeaconFixture(): Promise<AddressBeacon> {
  const Factory = await ethers.getContractFactory('AddressBeacon')
  return (await Factory.deploy()) as AddressBeacon
}

export async function mockAddressBeaconFixture(): Promise<MockContract<AddressBeacon>> {
  const mockFactory = await smock.mock<AddressBeacon__factory>('AddressBeacon')
  return mockFactory.deploy()
}
