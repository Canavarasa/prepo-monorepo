/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { deployNonUpgradeableContract } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'

dotenv.config({
  path: '../.env',
})

const deployFunction: DeployFunction = async function deployUniswapV3Oracle(
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const { getChainId } = hre
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  const uniswapV3FactoryAddress = getPrePOAddressForNetwork(
    'UNIV3_FACTORY',
    currentNetwork.name,
    process.env.UNIV3_FACTORY
  )
  // mean-finance recommends a cardinality per minute of 60 for Arbitrum
  await deployNonUpgradeableContract(
    'UniswapV3Oracle',
    DEPLOYMENT_NAMES.uniswapV3Oracle.name,
    [uniswapV3FactoryAddress, 200],
    hre
  )
}

export default deployFunction

deployFunction.tags = ['UniswapV3Oracle']
