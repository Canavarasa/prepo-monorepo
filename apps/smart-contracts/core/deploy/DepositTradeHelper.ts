/* eslint-disable no-console */
import { NonceManager } from '@ethersproject/experimental'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { deployNonUpgradeableContract, setSingleValueIfNotAlreadySet } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'

dotenv.config({
  path: '../.env',
})

type NonceManagerWithAddress = NonceManager & { address?: string }

const deployFunction: DeployFunction = async function deployDepositTradeHelper(
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const { getChainId, ethers } = hre
  const signer = (await ethers.getSigners())[0]
  const nonceManager: NonceManagerWithAddress = new NonceManager(signer)
  nonceManager.address = signer.address
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  const existingCollateral = await hre.ethers.getContract(DEPLOYMENT_NAMES.preWstETH.name)

  const swapRouterAddress = getPrePOAddressForNetwork(
    'UNIV3_SWAP_ROUTER',
    currentNetwork.name,
    process.env.UNIV3_SWAP_ROUTER
  )
  const balancerVaultAddress = getPrePOAddressForNetwork(
    'WSTETH_ETH_BALANCER_VAULT',
    currentNetwork.name,
    process.env.WSTETH_ETH_BALANCER_VAULT
  )
  const governanceAddress = getPrePOAddressForNetwork(
    'GOVERNANCE',
    currentNetwork.name,
    process.env.GOVERNANCE
  )

  const depositTradeHelper = await deployNonUpgradeableContract(
    'DepositTradeHelper',
    DEPLOYMENT_NAMES.depositTradeHelper.name,
    [existingCollateral.address, swapRouterAddress, balancerVaultAddress],
    hre
  )
  await setSingleValueIfNotAlreadySet(
    nonceManager,
    depositTradeHelper,
    '0x36bf227d6bac96e2ab1ebb5492ecec69c691943f000200000000000000000316',
    'getWstethPoolId',
    'setWstethPoolId'
  )
  await setSingleValueIfNotAlreadySet(
    nonceManager,
    depositTradeHelper,
    governanceAddress,
    'getTreasury',
    'setTreasury'
  )
}

export default deployFunction

deployFunction.tags = ['DepositTradeHelper']
