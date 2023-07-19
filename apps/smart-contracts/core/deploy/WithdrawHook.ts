/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DEPLOYMENT_NAMES } from 'prepo-constants'
import { deployNonUpgradeableContract } from 'prepo-hardhat'
import dotenv from 'dotenv'

dotenv.config({
  path: '../.env',
})

const deployFunction: DeployFunction = async function deployWithdrawHook(
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  await deployNonUpgradeableContract(
    'WithdrawHook',
    DEPLOYMENT_NAMES.preWstETH.withdrawHook.name,
    [18],
    hre
  )
}

export default deployFunction

deployFunction.tags = ['WithdrawHook']
