import { ethers } from 'hardhat'
import { PrePOMarketFactory } from '../../types/generated'

export async function prePOMarketFactoryFixture(): Promise<PrePOMarketFactory> {
  const factory = await ethers.getContractFactory('PrePOMarketFactory')
  return (await factory.deploy()) as PrePOMarketFactory
}
