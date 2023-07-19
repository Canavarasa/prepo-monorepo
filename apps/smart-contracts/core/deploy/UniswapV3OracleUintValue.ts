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

const deployFunction: DeployFunction = async function deployUniswapV3OracleUintValue(
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const { getChainId } = hre
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  const uniV3OracleAddress = getPrePOAddressForNetwork(
    'UNIV3_ORACLE',
    currentNetwork.name,
    process.env.UNIV3_ORACLE
  )
  const usdcAddress = getPrePOAddressForNetwork('USDC', currentNetwork.name, process.env.USDC)
  const wethAddress = getPrePOAddressForNetwork('WETH', currentNetwork.name, process.env.WETH)
  await deployNonUpgradeableContract(
    'UniswapV3OracleUintValue',
    DEPLOYMENT_NAMES.ppoUSDCtoETHOracle.name,
    [uniV3OracleAddress, usdcAddress, wethAddress],
    hre
  )
}

export default deployFunction

deployFunction.tags = ['UniswapV3OracleUintValue']
