/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'
import { FormatTypes, getContractAddress } from 'ethers/lib/utils'
import { fromChainId } from 'defender-base-client'
import { TransactionResponse } from '@ethersproject/providers'

dotenv.config({
  path: '../.env',
})

const { assertIsTestnetChain, getDefenderAdminClient } = utils

const deployFunction: DeployFunction = async function deployCollateral({
  deployments,
  getChainId,
  ethers,
  upgrades,
}: HardhatRuntimeEnvironment): Promise<void> {
  const { save, getOrNull, getArtifact } = deployments
  const deployer = (await ethers.getSigners())[0]
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  console.log(
    `Running Collateral deployment script against ${currentNetwork.name} with ${deployer.address} as the deployer`
  )
  /**
   * Make sure this script is not accidentally targeted towards a production environment.
   * This can be temporarily removed if deploying to prod.
   */
  assertIsTestnetChain(currentChain)
  const baseTokenAddress = getPrePOAddressForNetwork(
    'WSTETH',
    currentNetwork.name,
    process.env.WSTETH
  )
  const collateralFactory = await ethers.getContractFactory('Collateral')
  const deploymentName = DEPLOYMENT_NAMES.preWstETH.name
  const existingDeployment = await getOrNull(deploymentName)
  const collateralArtifact = await getArtifact('Collateral')
  if (!existingDeployment) {
    console.log('Existing deployment not detected, deploying new contract')
    const newDeployment = await upgrades.deployProxy(
      collateralFactory,
      ['prePO wstETH Collateral', 'preWstETH'],
      {
        unsafeAllow: ['constructor', 'state-variable-immutable'],
        constructorArgs: [baseTokenAddress, 18],
      }
    )
    console.log('Deployed', deploymentName, 'at', newDeployment.address)
    const deploymentReceipt = await newDeployment.deployTransaction.wait()
    /**
     * Although `deployProxy` returns an ABI, we have to refetch the ABI from
     * hardhat-deploy since ABIs returned from OZ have some compatibility
     * issues with `hardhat-deploy`. If you try to fetch a manually saved
     * contract saved with an ABI returned from `deployProxy`, it will fail.
     */
    await save(deploymentName, {
      abi: collateralArtifact.abi,
      address: newDeployment.address,
      receipt: deploymentReceipt,
    })
  } else {
    console.log(`Existing deployment detected at ${existingDeployment.address}`)
    if (existingDeployment.abi.toString() !== collateralArtifact.abi.toString()) {
      console.log('Current ABI does not match ABI of existing deployment, proposing upgrade...')
      /**
       * Need to explicitly cast as TransactionResponse since an upgrade
       * proposal can be a string or TransactionResponse object. Tedious string
       * checks for when it is not a TransactionResponse would be required
       * multiple times throughout the script if we do not explicitly recast.
       */
      const upgradeResponse = (await upgrades.prepareUpgrade(
        existingDeployment.address,
        collateralFactory,
        {
          unsafeAllow: ['constructor', 'state-variable-immutable'],
          constructorArgs: [baseTokenAddress, 18],
          getTxResponse: true,
        }
      )) as TransactionResponse
      const newImplAddress = getContractAddress(upgradeResponse)
      const upgradeReceipt = await upgradeResponse.wait()
      const defenderClient = getDefenderAdminClient(currentChain)
      const upgradeProposal = await defenderClient.proposeUpgrade(
        {
          title: `${deploymentName} Upgrade`,
          description: `${deploymentName} Upgrade Proposal`,
          proxyAdmin: (await upgrades.admin.getInstance()).address,
          newImplementation: newImplAddress,
        },
        {
          address: existingDeployment.address,
          network: fromChainId(currentChain),
          abi: collateralFactory.interface.format(FormatTypes.json) as string,
        }
      )
      console.log(`${deploymentName} Upgrade Receipt:`, upgradeResponse)
      /**
       * Because this is only a proposal and not an actual deployment, a
       * contract instance is not returned for us to fetch a `hardhat-deploy`
       * readable ABI. Instead, we must fetch the artifact locally using
       * `getArtifact` from `hardhat-deploy` which contains a `hardhat-deploy`
       * compatible ABI.
       *
       * Since we don't actually know if the upgrade proposal will pass this,
       * script assumes the upgrade happened and overwrites the existing
       * deployment with the new ABI.
       */
      await save(deploymentName, {
        abi: collateralArtifact.abi,
        address: upgradeProposal.contract.address,
        receipt: upgradeReceipt,
      })
    } else {
      console.log('Current ABI matches ABI of existing deployment, skipping upgrade')
    }
  }
  console.log('')
}

export default deployFunction

deployFunction.tags = ['Collateral']
