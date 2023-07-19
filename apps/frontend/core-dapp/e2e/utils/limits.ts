import { ethers } from 'ethers'
import { NETWORKS } from 'prepo-constants'
import { getContractAddress } from 'prepo-utils'
import { parseEther } from 'ethers/lib/utils'
import { Addresses } from './addresses'
import { ImpersonatedSigner } from '../../src/utils/ImpersonatedSigner'
import { supportedContracts } from '../../src/lib/supported-contracts'
import {
  CollateralAbi__factory,
  DepositHookAbi__factory,
  DepositRecordAbi__factory,
  WithdrawHookAbi__factory,
} from '../../generated/typechain'

export async function increaseDepositLimits({ rpcUrl }: { rpcUrl: string }): Promise<void> {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, NETWORKS.arbitrumOne)

  const collateralAddress = getContractAddress('COLLATERAL', 'arbitrumOne', supportedContracts)
  if (!collateralAddress) throw new Error("Can't find DepositRecord")

  const collateralContract = CollateralAbi__factory.connect(collateralAddress, provider)
  const depositHookAddress = await collateralContract.getDepositHook()

  const depositHook = DepositHookAbi__factory.connect(depositHookAddress, provider)
  const depositRecordAddress = await depositHook.getDepositRecord()

  const depositRecord = DepositRecordAbi__factory.connect(
    depositRecordAddress,
    new ImpersonatedSigner(Addresses.PREPO_MULTISIG, provider)
  )

  const globalCap = await depositRecord.getGlobalNetDepositCap()
  await depositRecord.setGlobalNetDepositCap(globalCap.add(parseEther('100')))

  const userCap = await depositRecord.getUserDepositCap()
  await depositRecord.setUserDepositCap(userCap.add(parseEther('100')))
}

export async function increaseWithdrawLimits({ rpcUrl }: { rpcUrl: string }): Promise<void> {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, NETWORKS.arbitrumOne)

  const collateralAddress = getContractAddress('COLLATERAL', 'arbitrumOne', supportedContracts)
  if (!collateralAddress) throw new Error("Can't find Collateral")
  const collateral = CollateralAbi__factory.connect(collateralAddress, provider)

  const withdrawHook = WithdrawHookAbi__factory.connect(
    await collateral.getWithdrawHook(),
    new ImpersonatedSigner(Addresses.PREPO_MULTISIG, provider)
  )

  const capBefore = await withdrawHook.getGlobalWithdrawLimitPerPeriod()
  await withdrawHook.setGlobalWithdrawLimitPerPeriod(capBefore.add(parseEther('100')))
}
