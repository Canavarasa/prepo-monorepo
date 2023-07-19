import { ethers } from 'hardhat'
import { DepositTradeHelper } from '../../types/generated'

export async function depositTradeHelperFixture(
  collateral: string,
  swapRouter: string,
  wstethVault: string
): Promise<DepositTradeHelper> {
  const factory = await ethers.getContractFactory('DepositTradeHelper')
  return (await factory.deploy(collateral, swapRouter, wstethVault)) as DepositTradeHelper
}
