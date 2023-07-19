/* eslint-disable no-console */
import { NonceManager } from '@ethersproject/experimental'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId } from 'prepo-constants'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'
import { ProdCore } from '../harnesses/prod'
import { configureTokenSenderViaSigner } from '../helpers'

dotenv.config({
  path: '../.env',
})

type NonceManagerWithAddress = NonceManager & { address?: string }

const deployFunction: DeployFunction = async function configureStackViaSigner(
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const { ethers, getChainId } = hre
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  const core = await ProdCore.Instance.init(ethers, currentNetwork)
  const signer = (await ethers.getSigners())[0]
  const nonceManager: NonceManagerWithAddress = new NonceManager(signer)
  nonceManager.address = signer.address
  await core.deployPeripheralContracts(hre)
  await core.assignRolesForProdStack(nonceManager, nonceManager)
  /**
   * Modify this object to configure the stack. Defining parameters for
   * the stack as a modifiable literal makes it easier for the deployer
   * to understand what they are configuring and what needs configuring.
   *
   * Values not provided will be ignored.
   */
  const deploymentParameters = {
    collateral: {
      depositFee: undefined,
      withdrawFee: undefined,
    },
    depositHook: {
      depositsAllowed: undefined,
      treasury: undefined,
      tokenSender: {
        priceMultiplier: undefined,
        scaledPriceLowerBound: undefined,
        allowedMsgSenders: undefined,
      },
    },
    withdrawHook: {
      globalPeriodLength: undefined,
      globalWithdrawLimitPerPeriod: undefined,
      treasury: undefined,
      tokenSender: {
        priceMultiplier: undefined,
        scaledPriceLowerBound: undefined,
        allowedMsgSenders: undefined,
      },
    },
    depositRecord: {
      globalNetDepositCap: undefined,
      userDepositCap: undefined,
      allowedMsgSenders: undefined,
      bypasslist: undefined,
    },
    ppoUSDCtoETHOracle: {
      observationPeriod: undefined,
      baseAmount: undefined,
    },
  }
  console.log('\nConfiguring Collateral via Signer...')
  await core.configureCollateralViaSigner(
    nonceManager,
    deploymentParameters.collateral.depositFee,
    deploymentParameters.collateral.withdrawFee
  )
  console.log('\nConfiguring DepositHook via Signer...')
  await core.configureDepositHookViaSigner(
    nonceManager,
    deploymentParameters.depositHook.depositsAllowed,
    deploymentParameters.depositHook.treasury
  )
  console.log('\nConfiguring DepositHook-TokenSender via Signer...')
  await configureTokenSenderViaSigner(
    core.collateral.depositHook.tokenSender,
    nonceManager,
    deploymentParameters.depositHook.tokenSender.priceMultiplier,
    deploymentParameters.depositHook.tokenSender.scaledPriceLowerBound,
    deploymentParameters.depositHook.tokenSender.allowedMsgSenders
  )
  console.log('\nConfiguring WithdrawHook via Signer...')
  await core.configureWithdrawHookViaSigner(
    nonceManager,
    deploymentParameters.withdrawHook.globalPeriodLength,
    deploymentParameters.withdrawHook.globalWithdrawLimitPerPeriod,
    deploymentParameters.withdrawHook.treasury
  )
  console.log('\nConfiguring WithdrawHook-TokenSender via Signer...')
  await configureTokenSenderViaSigner(
    core.collateral.withdrawHook.tokenSender,
    nonceManager,
    deploymentParameters.withdrawHook.tokenSender.priceMultiplier,
    deploymentParameters.withdrawHook.tokenSender.scaledPriceLowerBound,
    deploymentParameters.withdrawHook.tokenSender.allowedMsgSenders
  )
  console.log('\nConfiguring DepositRecord via Signer...')
  await core.configureDepositRecordViaSigner(
    nonceManager,
    deploymentParameters.depositRecord.globalNetDepositCap,
    deploymentParameters.depositRecord.userDepositCap,
    deploymentParameters.depositRecord.allowedMsgSenders,
    deploymentParameters.depositRecord.bypasslist
  )
  console.log('\nConfiguring USDC/ETH Oracle via Signer...')
  await core.configureUniswapV3OracleUintValueViaSigner(
    nonceManager,
    deploymentParameters.ppoUSDCtoETHOracle.observationPeriod,
    deploymentParameters.ppoUSDCtoETHOracle.baseAmount
  )
  console.log('\nConfiguring PrePOMarketFactory via Signer...')
  await core.configurePrePOMarketFactoryViaSigner(nonceManager)
}

export default deployFunction

deployFunction.dependencies = [
  'ArbitrageBroker',
  'Collateral',
  'DepositHook',
  'DepositRecord',
  'PrePOMarketFactory',
  'WithdrawHook',
  'UniswapV3OracleUintValue',
]

deployFunction.tags = ['ConfigureStackViaSigner']
