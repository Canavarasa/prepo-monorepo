const { ethers, upgrades } = require('hardhat')
const { getImplementationAddress } = require('@openzeppelin/upgrades-core')
const { getTargetAddress, setTargetAddress } = require('../helpers')

const user_key1 = process.env.PRIVATE_KEY
const WEEK = 604800

async function main() {
  let networkObj = await ethers.provider.getNetwork()
  let network = networkObj.name
  if (networkObj.chainId == 10) {
    networkObj.name = 'optimisticEthereum'
    network = 'optimisticEthereum'
  }
  if (networkObj.chainId == 69) {
    network = 'optimisticKovan'
  }
  if (networkObj.chainId == 42) {
    network = 'kovan'
  }
  if (network == 'homestead') {
    network = 'mainnet'
  }

  const owner = new ethers.Wallet(user_key1, ethers.provider)

  console.log('Owner is:' + owner.address)
  console.log('Network name:' + network)
  const ProxyStaking = await ethers.getContractFactory('SingleTokenStakingRewards')

  let ProxyStaking_deployed = await upgrades.deployProxy(ProxyStaking, [
    owner.address,
    '0xB40DBBb7931Cfef8Be73AEEC6c67d3809bD4600B',
    WEEK * 10,
  ])
  let tx = await ProxyStaking_deployed.deployed()

  console.log('Staking proxy:', ProxyStaking_deployed.address)
  await delay(15000)

  const StakingImplementation = await getImplementationAddress(
    ethers.provider,
    ProxyStaking_deployed.address
  )
  console.log('Implementation Staking: ', StakingImplementation)

  //setTargetAddress('LPStakingRewards', network, '0xC5eF65AbE903965db5D0a7c529D181fd1a1e8bFf');
  //setTargetAddress('LPStakingRewardsImplementation', network, '0x3FbF14e046556f7A13F77930D4363c0BbBAddF36');

  // TODO: call notifyReward after transfering the reward to the contract
  try {
    await hre.run('verify:verify', {
      address: ProxyStaking_deployed.address,
    })
  } catch (e) {
    console.log(e)
  }

  try {
    await hre.run('verify:verify', {
      address: StakingImplementation,
    })
  } catch (e) {
    console.log(e)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  })
}
