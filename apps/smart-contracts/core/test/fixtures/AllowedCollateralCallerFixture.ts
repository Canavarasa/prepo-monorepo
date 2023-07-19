import { ethers } from 'hardhat'
import { AllowedCollateralCaller } from '../../types/generated'

export async function allowedCollateralCallerFixture(): Promise<AllowedCollateralCaller> {
  const factory = await ethers.getContractFactory('AllowedCollateralCaller')
  return (await factory.deploy()) as AllowedCollateralCaller
}
