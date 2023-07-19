import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { ERC20 } from '../../types/generated'

export async function ERC20AttachFixture(
  ethers: HardhatEthersHelpers,
  tokenAddress: string
): Promise<ERC20> {
  const factory = await ethers.getContractFactory('ERC20')
  return (await factory.attach(tokenAddress)) as ERC20
}
