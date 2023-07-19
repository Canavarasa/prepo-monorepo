/* eslint-disable no-console */
import { NonceManager } from '@ethersproject/experimental'
import { parseEther } from '@ethersproject/units'
import { task } from 'hardhat/config'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import { ProdCore } from '../harnesses/prod'
import { getDeterministicMarketAddress } from '../helpers'

const { getDefenderAdminClient } = utils

type NonceManagerWithAddress = NonceManager & { address?: string }

task('create-salts', 'create salts from parameters')
  .addParam('nameSuffix', 'suffix of market token name e.g. preSTRIPE 5000-10000 30-September 2023')
  .addParam('symbolSuffix', 'suffix of market token symbol e.g. preSTRIPE_5000-10000_30SEP23')
  .setAction(async (args, hre) => {
    const { ethers, getChainId } = hre
    const currentChain = Number(await getChainId()) as ChainId
    const currentNetwork = getNetworkByChainId(currentChain)
    const core = await ProdCore.Instance.init(ethers, currentNetwork)
    const signer = (await ethers.getSigners())[0]
    const nonceManager: NonceManagerWithAddress = new NonceManager(signer)
    nonceManager.address = signer.address
    const longShortSalts = await core.generateLongShortSalts(
      core.marketFactory.address,
      args.nameSuffix,
      args.symbolSuffix,
      utils.generateLowerAddress
    )
    console.log(longShortSalts)
  })

task('create-market', 'create PrePOMarket from PrePOMarketFactory')
  .addParam('nameSuffix', 'suffix of market token name e.g. preSTRIPE 5000-10000 30-September 2023')
  .addParam('symbolSuffix', 'suffix of market token symbol e.g. preSTRIPE_5000-10000_30SEP23')
  .addParam(
    'floorPayout',
    "floor payout in ether units for Long token position e.g. '0.5' = 0.5 ether = 50%"
  )
  .addParam(
    'ceilingPayout',
    "ceiling payout in ether units for Long token position e.g. '1' = 1 ether = 100%"
  )
  .addParam('floorValuation', "floor valuation of asset in billions of $ e.g. '123' = $123B")
  .addParam('ceilingValuation', "ceiling valuation of asset in billions of $ e.g. '123' = $123B")
  .addParam('expiryTime', 'market end time as a UNIX timestamp in seconds')
  .setAction(async (args, hre) => {
    const { ethers, getChainId } = hre
    const currentChain = Number(await getChainId()) as ChainId
    const currentNetwork = getNetworkByChainId(currentChain)
    const core = await ProdCore.Instance.init(ethers, currentNetwork)
    const signer = (await ethers.getSigners())[0]
    const nonceManager: NonceManagerWithAddress = new NonceManager(signer)
    nonceManager.address = signer.address
    const governanceAddress = getPrePOAddressForNetwork(
      'GOVERNANCE',
      currentNetwork.name,
      process.env.GOVERNANCE
    )
    const longShortSalts = await core.generateLongShortSalts(
      core.marketFactory.address,
      args.nameSuffix,
      args.symbolSuffix,
      utils.generateLowerAddress
    )
    /**
     * We need to determine the market address ahead of time because this is
     * a proposal. We need the address ahead of time for the following reasons:
     *
     * 1. While this could be done later, we want to assign the market ahead of time
     * as an allowed msg sender for the mint and redeem hooks.
     *
     * 2. We want to batch market deployment along with setting of the minthook and redeemhook
     * so that future markets are not hijacked due to someone minting/redeeming positions prior
     * to us setting the hooks. The batch proposal API of OZ requires registration of a contract
     * prior to adding it as a target for a batch transaction. The contract does not need to exist,
     * it just needs to be registered in the API. Thus, we need the address to register it
     * prior to it being deployed.
     */
    console.log('Generating market address ahead of time...')
    const deterministicMarketAddress = await getDeterministicMarketAddress(
      ethers,
      core.marketFactory.address,
      longShortSalts[0].address,
      longShortSalts[1].address,
      governanceAddress,
      core.collateral.address,
      parseEther(args.floorPayout),
      parseEther(args.ceilingPayout),
      Number(args.floorValuation),
      Number(args.ceilingValuation),
      Number(args.expiryTime)
    )
    console.log('Deterministic Market Address: ', deterministicMarketAddress)
    const defenderClient = getDefenderAdminClient(currentChain)
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const defenderNetworkName = currentNetwork.defenderName as any
    const prePOMarketName = `${args.nameSuffix}`
    const prePOMarketArtifact = await hre.artifacts.readArtifact('PrePOMarket')
    console.log('Adding Contract Defender Entry Ahead of Time...')
    await defenderClient.addContract({
      network: defenderNetworkName,
      address: deterministicMarketAddress,
      name: prePOMarketName,
      abi: prePOMarketArtifact.abi.toString(),
    })
    const prePOMarketFactoryArtifact = await hre.artifacts.readArtifact('PrePOMarketFactory')
    // We don't use getContractOrNull here because we want to fail if the contract is not deployed
    const mintHook = await ethers.getContract(`MintHook`)
    const redeemHook = await ethers.getContract(`RedeemHook`)
    console.log('Submitting Market Creation Proposal...')
    await defenderClient.createProposal({
      contract: [
        {
          address: core.marketFactory.address,
          name: DEPLOYMENT_NAMES.prePOMarketFactory.name,
          network: defenderNetworkName,
          abi: prePOMarketFactoryArtifact.abi.toString(),
        },
        {
          address: deterministicMarketAddress,
          name: prePOMarketName,
          network: defenderNetworkName,
          abi: prePOMarketArtifact.abi.toString(),
        },
      ],
      title: `Deploy ${prePOMarketName}`,
      description: `
        Deploy ${prePOMarketName} with the following parameters:
        | tokenNameSuffix: ${args.nameSuffix}
        | tokenSymbolSuffix: ${args.symbolSuffix}
        | longTokenSalt: ${longShortSalts[0].salt}
        | shortTokenSalt: ${longShortSalts[1].salt}
        | owner: ${governanceAddress}
        | collateral: ${core.collateral.address}
        | floorLongPayout: ${args.floorPayout} Collateral
        | ceilingLongPayout: ${args.ceilingPayout} Collateral
        | floorValuation: $${args.floorValuation}
        | ceilingValuation: $${args.ceilingValuation}
        | expiryTime: ${new Date(args.expiryTime * 1000).toLocaleString('en-US', {
          timeZone: 'UTC',
          timeZoneName: 'short',
        })}
      `,
      type: 'batch',
      via: governanceAddress,
      viaType: 'Gnosis Safe',
      // metadata is a required field, but can be blank
      metadata: {},
      // contractIds are the names of contracts as stored in OZ's database
      steps: [
        {
          contractId: `${defenderNetworkName}-${core.marketFactory.address}`,
          type: 'custom',
          targetFunction: {
            name: 'createMarket',
            inputs: [
              { type: 'string', name: '_tokenNameSuffix' },
              { type: 'string', name: '_tokenSymbolSuffix' },
              { type: 'bytes32', name: 'longTokenSalt' },
              { type: 'bytes32', name: 'shortTokenSalt' },
              { type: 'address', name: 'owner' },
              { type: 'address', name: '_collateral' },
              { type: 'uint256', name: '_floorLongPayout' },
              { type: 'uint256', name: '_ceilingLongPayout' },
              { type: 'uint256', name: '_floorValuation' },
              { type: 'uint256', name: '_ceilingValuation' },
              { type: 'uint256', name: '_expiryTime' },
            ],
          },
          functionInputs: [
            args.nameSuffix,
            args.symbolSuffix,
            longShortSalts[0].salt,
            longShortSalts[1].salt,
            governanceAddress,
            core.collateral.address,
            parseEther(args.floorPayout).toString(),
            parseEther(args.ceilingPayout).toString(),
            args.floorValuation,
            args.ceilingValuation,
            args.expiryTime,
          ],
        },
        {
          contractId: `${defenderNetworkName}-${deterministicMarketAddress}`,
          type: 'custom',
          targetFunction: {
            name: 'grantRole',
            inputs: [
              { type: 'bytes32', name: 'role' },
              { type: 'address', name: 'account' },
            ],
          },
          functionInputs: [
            '0x5a1c9155e9f8980842842449b05c3e077e14daf295a3ccdf9977298231ad87f5',
            governanceAddress,
          ],
        },
        {
          contractId: `${defenderNetworkName}-${deterministicMarketAddress}`,
          type: 'custom',
          targetFunction: {
            name: 'acceptRole',
            inputs: [{ type: 'bytes32', name: 'role' }],
          },
          functionInputs: ['0x5a1c9155e9f8980842842449b05c3e077e14daf295a3ccdf9977298231ad87f5'],
        },
        {
          contractId: `${defenderNetworkName}-${deterministicMarketAddress}`,
          type: 'custom',
          targetFunction: {
            name: 'grantRole',
            inputs: [
              { type: 'bytes32', name: 'role' },
              { type: 'address', name: 'account' },
            ],
          },
          functionInputs: [
            '0xf6b0b43b02b58005182aad849914a745362ef0bb4533d84f17570c7c82f4dcf2',
            governanceAddress,
          ],
        },
        {
          contractId: `${defenderNetworkName}-${deterministicMarketAddress}`,
          type: 'custom',
          targetFunction: {
            name: 'acceptRole',
            inputs: [{ type: 'bytes32', name: 'role' }],
          },
          functionInputs: ['0xf6b0b43b02b58005182aad849914a745362ef0bb4533d84f17570c7c82f4dcf2'],
        },
        {
          contractId: `${defenderNetworkName}-${deterministicMarketAddress}`,
          type: 'custom',
          targetFunction: {
            name: 'setMintHook',
            inputs: [{ type: 'address', name: 'mintHook' }],
          },
          functionInputs: [mintHook.address],
        },
        {
          contractId: `${defenderNetworkName}-${deterministicMarketAddress}`,
          type: 'custom',
          targetFunction: {
            name: 'setRedeemHook',
            inputs: [{ type: 'address', name: 'redeemHook' }],
          },
          functionInputs: [redeemHook.address],
        },
      ],
    })
  })
