import { FakeContract, smock } from '@defi-wonderland/smock'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { IVault } from '../../types/generated'

export function attachVaultFixture(ethers: HardhatEthersHelpers, vault: string): Promise<IVault> {
  return ethers.getContractAt('IVault', vault) as Promise<IVault>
}

export function fakeVaultFixture(): Promise<FakeContract<IVault>> {
  return smock.fake<IVault>('IVault')
}
