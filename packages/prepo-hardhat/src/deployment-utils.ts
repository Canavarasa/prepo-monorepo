/* eslint-disable no-console */
import { Contract } from 'ethers'
import { ChainId } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'

const { assertIsTestnetChain } = utils

export async function deployNonUpgradeableContract(
  contractName: string,
  deploymentName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructorArgs: any[],
  /**
   * Use any here because hardhat runtime type can change per project
   * and if imported here, will differ from the `HardhatRuntimeEnvironment`
   * type in the source project.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hre: any,
  assertIsTestnet = true
): Promise<Contract> {
  const { ethers, deployments, getChainId } = hre
  const { deploy } = deployments
  const deployer = (await ethers.getSigners())[0]
  const currentChain = Number(await getChainId()) as ChainId
  /**
   * Make sure this script is not accidentally targeted towards a production environment.
   * This can be temporarily removed if deploying to prod.
   */
  if (assertIsTestnet) assertIsTestnetChain(currentChain)
  const currentNetwork = getNetworkByChainId(currentChain)
  console.log(
    `Running ${contractName} deployment script against ${currentNetwork.name} with ${deployer.address} as the deployer`
  )
  const { address: contractAddress, newlyDeployed } = await deploy(deploymentName, {
    from: deployer.address,
    contract: contractName,
    deterministicDeployment: false,
    args: constructorArgs,
    skipIfAlreadyDeployed: true,
  })
  if (newlyDeployed) {
    console.log(`Deployed ${deploymentName} to`, contractAddress)
  } else {
    console.log(`Existing ${deploymentName} at`, contractAddress)
  }
  console.log('')
  return ethers.getContract(deploymentName)
}
