import { ethers } from 'hardhat'
import { UintBeacon, AddressBeacon } from '../../types/generated'

export async function uintBeaconFixture(): Promise<UintBeacon> {
  const Factory = await ethers.getContractFactory('UintBeacon')
  return (await Factory.deploy()) as UintBeacon
}

export async function addressBeaconFixture(): Promise<AddressBeacon> {
  const Factory = await ethers.getContractFactory('AddressBeacon')
  return (await Factory.deploy()) as AddressBeacon
}
