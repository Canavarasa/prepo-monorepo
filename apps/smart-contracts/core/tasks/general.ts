/* eslint-disable no-console */
import { task } from 'hardhat/config'
import { ChainId } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'

const { getDefenderAdminClient } = utils

task('save-deployment', 'saves deployment manually given a tx receipt')
  .addParam('contractName', 'contract name to source ABI from')
  .addParam('deploymentName', 'name deployment will be saved as')
  .addParam('contractAddress', 'address of deployed contract')
  .addParam('txHash', 'transaction hash of deployment')
  .setAction(async (args, hre) => {
    const { deployments, getChainId } = hre
    const { save } = deployments
    const currentChain = Number(await getChainId()) as ChainId
    const currentNetwork = getNetworkByChainId(currentChain)
    console.log(`Saving deployment on ${currentNetwork.name}`)
    const contractArtifact = hre.artifacts.readArtifactSync(args.contractName)
    const txReceipt = await hre.ethers.provider.getTransactionReceipt(args.txHash)
    await save(args.deploymentName, {
      abi: contractArtifact.abi,
      address: args.contractAddress,
      receipt: txReceipt,
    })
  })

task('delete-oz-contracts', 'deletes OpenZeppelin contracts from portal')
  .addParam('contractAddress', 'address of contract entry to delete')
  .setAction(async (args, hre) => {
    const { getChainId } = hre
    const currentChain = Number(await getChainId()) as ChainId
    const currentNetwork = getNetworkByChainId(currentChain)
    const defenderClient = getDefenderAdminClient(currentChain)
    await defenderClient.deleteContract(`${currentNetwork.defenderName}-${args.contractAddress}`)
  })
