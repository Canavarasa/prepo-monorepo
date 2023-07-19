/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DEPLOYMENT_NAMES } from 'prepo-constants'
import { deployNonUpgradeableContract } from 'prepo-hardhat'
import dotenv from 'dotenv'

dotenv.config({
  path: '../.env',
})

const deployFunction: DeployFunction = async function deployDepositHook(
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  await deployNonUpgradeableContract(
    'DepositHook',
    DEPLOYMENT_NAMES.preWstETH.depositHook.name,
    [],
    hre
  )
}

export default deployFunction

deployFunction.tags = ['DepositHook']
