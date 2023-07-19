import { FakeContract, smock } from '@defi-wonderland/smock'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { IUniswapV3Oracle } from '../../types/generated'

export function attachUniswapV3OracleFixture(
  ethers: HardhatEthersHelpers,
  oracle: string
): Promise<IUniswapV3Oracle> {
  return ethers.getContractAt('IUniswapV3Oracle', oracle) as Promise<IUniswapV3Oracle>
}

export function fakeUniswapV3OracleFixture(): Promise<FakeContract<IUniswapV3Oracle>> {
  return smock.fake<IUniswapV3Oracle>('IUniswapV3Oracle')
}
