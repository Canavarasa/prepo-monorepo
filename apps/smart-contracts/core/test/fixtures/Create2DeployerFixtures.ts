import { ethers } from 'hardhat'
import { Create2Deployer } from '../../types/generated'

export async function create2DeployerFixture(): Promise<Create2Deployer> {
  const factory = await ethers.getContractFactory('Create2Deployer')
  return (await factory.deploy()) as Create2Deployer
}
