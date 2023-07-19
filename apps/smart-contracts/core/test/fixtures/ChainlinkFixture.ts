import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { AggregatorInterface } from '../../types/generated'

export function attachAggregatorInterfaceFixture(
  ethers: HardhatEthersHelpers,
  oracle: string
): Promise<AggregatorInterface> {
  return ethers.getContractAt('AggregatorInterface', oracle) as Promise<AggregatorInterface>
}
