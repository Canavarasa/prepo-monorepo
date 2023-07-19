import { BigNumber, providers, Contract, ContractTransaction, Signature } from 'ethers'
import { parse, stringify } from 'envfile'
import { ChainId, NETWORKS, Network, EIP712Domain } from 'prepo-constants'
import {
  BytesLike,
  formatBytes32String,
  getCreate2Address,
  hexZeroPad,
  keccak256,
  splitSignature,
} from 'ethers/lib/utils'
import { AdminClient } from 'defender-admin-client'
import { ProposalStep } from 'defender-admin-client/lib/models/proposal'
import { SmockContractBase } from '@defi-wonderland/smock'
import { TypedDataUtils, SignTypedDataVersion } from '@metamask/eth-sig-util'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { readFileSync, writeFileSync } from 'fs'

function expandToDecimals(n: number, decimals: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(decimals))
}

function expandTo6Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(6))
}

function expandTo18Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

function nowPlusMonths(n: number): number {
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  d.setHours(0, 0, 0, 0)
  return d.getTime() / 1000
}

function getZeroPadHexFromAddress(address: string): string {
  return hexZeroPad(address, 32)
}

async function getLastTimestamp(
  provider: providers.Web3Provider | providers.JsonRpcProvider
): Promise<number> {
  /**
   * Changed this from ethers.provider.getBlockNumber since if evm_revert is used to return
   * to a snapshot, getBlockNumber will still return the last mined block rather than the
   * block height of the snapshot.
   */
  const currentBlock = await provider.getBlock('latest')
  return currentBlock.timestamp
}

async function setNextTimestamp(
  provider: providers.Web3Provider | providers.JsonRpcProvider,
  timestamp: number
): Promise<void> {
  await provider.send('evm_setNextBlockTimestamp', [timestamp])
}

export async function sendTxAndWait(transaction: ContractTransaction): Promise<void> {
  await transaction.wait()
}

function isTestnetChain(chainId: ChainId): boolean {
  const testChains = [
    NETWORKS.hardhat.chainId,
    NETWORKS.ropsten.chainId,
    NETWORKS.rinkeby.chainId,
    NETWORKS.goerli.chainId,
    NETWORKS.kovan.chainId,
    NETWORKS.arbitrumTestnet.chainId,
  ]
  return testChains.includes(+chainId)
}

function assertIsTestnetChain(chainId: ChainId): void {
  if (!isTestnetChain(chainId)) {
    throw new Error('Deployment to production environments is disabled!')
  }
}

function getDefenderAdminClient(chainId: ChainId): AdminClient {
  if (isTestnetChain(chainId))
    return new AdminClient({
      apiKey: process.env.DEFENDER_TEST_API_KEY,
      apiSecret: process.env.DEFENDER_TEST_API_SECRET,
    })
  return new AdminClient({
    apiKey: process.env.DEFENDER_PROD_API_KEY,
    apiSecret: process.env.DEFENDER_PROD_API_SECRET,
  })
}

function recordDeployment(envVarName: string, contract: Contract): void {
  const sourcePath = '.env'
  const parsedFile = parse(readFileSync(sourcePath).toString())
  parsedFile[envVarName] = contract.address
  writeFileSync(sourcePath, stringify(parsedFile))
  /**
   * Since current process will not recognize newly updated file, we need to update the
   * process.env for the remainder of the deployment task.
   */
  process.env[envVarName] = contract.address
}

async function mineBlocks(
  provider: providers.Web3Provider | providers.JsonRpcProvider,
  blocks: number
): Promise<void> {
  for (let i = 0; i < blocks; i++) {
    // eslint-disable-next-line no-await-in-loop
    await provider.send('evm_mine', [])
  }
}

// todo: Add type safety for token
async function getPermitSignature(
  token: Contract | SmockContractBase<Contract>,
  signer: SignerWithAddress,
  spender: string,
  value: BigNumber,
  deadline: number
): Promise<Signature> {
  const [nonce, name, version, chainId] = await Promise.all([
    token.nonces(signer.address),
    token.name(),
    '1',
    signer.getChainId(),
  ])
  return splitSignature(
    await signer._signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: signer.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  )
}

function mineBlock(
  provider: providers.Web3Provider | providers.JsonRpcProvider,
  timestamp: number
): Promise<void> {
  return provider.send('evm_mine', [timestamp])
}

export type Create2Address = {
  salt: string
  address: string
}

/**
 * Finds a create2 address less than `upperBoundAddress` for a specific
 * contract and deployer.
 * @param deployer Address of contract deployer
 * @param initCode Contract's bytecode w/ initialization parameters
 * @param upperBoundAddress The address to compare against
 * @returns Address and salt below `upperBoundAddress`
 */
function generateLowerAddress(
  deployer: string,
  initCode: BytesLike,
  upperBoundAddress: string
): Create2Address {
  const hashedInitCode = keccak256(initCode)
  const upperBoundAddressBN = BigNumber.from(upperBoundAddress)
  let randomString: string
  let currSalt: string
  let currAddress: string
  do {
    /**
     * Generates a random string using only the built-in Math library.
     * Takes a random number and converts it to a string, using radix
     * 36, encompassing 0-9 + 26 letters A-Z. Adds 1 to ensure an empty
     * string is never generated.
     * Substring is optional, used here to limit the size/complexity of
     * the string generated for test purposes.
     */
    randomString = (Math.random() + 1).toString(36).substring(7)
    currSalt = formatBytes32String(randomString)
    currAddress = getCreate2Address(deployer, currSalt, hashedInitCode)
  } while (BigNumber.from(currAddress).gte(upperBoundAddressBN))
  return {
    salt: currSalt,
    address: currAddress,
  }
}

function generateHigherAddress(
  deployer: string,
  initCode: BytesLike,
  lowerBoundAddress: string
): Create2Address {
  const hashedInitCode = keccak256(initCode)
  const lowerBoundAddressBN = BigNumber.from(lowerBoundAddress)
  let randomString: string
  let currSalt: string
  let currAddress: string
  do {
    /**
     * Generates a random string using only the built-in Math library.
     * Takes a random number and converts it to a string, using radix
     * 36, encompassing 0-9 + 26 letters A-Z. Adds 1 to ensure an empty
     * string is never generated.
     * Substring is optional, used here to limit the size/complexity of
     * the string generated for test purposes.
     */
    randomString = (Math.random() + 1).toString(36).substring(7)
    currSalt = formatBytes32String(randomString)
    currAddress = getCreate2Address(deployer, currSalt, hashedInitCode)
  } while (BigNumber.from(currAddress).lte(lowerBoundAddressBN))
  return {
    salt: currSalt,
    address: currAddress,
  }
}

export async function grantAndAcceptRole(
  contract: Contract | SmockContractBase<Contract>,
  admin: SignerWithAddress,
  nominee: SignerWithAddress,
  role: string
): Promise<void> {
  await contract.connect(admin).grantRole(role, nominee.address)
  await contract.connect(nominee).acceptRole(role)
}

export async function getRolesAccountDoesNotHave(
  contract: Contract | SmockContractBase<Contract>,
  accountAddress: string,
  roles: string[]
): Promise<string[]> {
  const promises: Promise<boolean>[] = []
  roles.forEach((role) => {
    promises.push(contract.hasRole(role, accountAddress))
  })
  const results = await Promise.all(promises)
  const rolesAccountDoesNotHave: string[] = []
  results.forEach((result, index) => {
    if (!result) {
      rolesAccountDoesNotHave.push(roles[index])
    }
  })
  return rolesAccountDoesNotHave
}

export async function batchGrantAndAcceptRoles(
  contract: Contract | SmockContractBase<Contract>,
  admin: SignerWithAddress,
  nominee: SignerWithAddress,
  roles: string[]
): Promise<void> {
  const rolesAccountDoesNotHave = await getRolesAccountDoesNotHave(contract, nominee.address, roles)
  const promises: Promise<void>[] = []
  rolesAccountDoesNotHave.forEach((role) => {
    promises.push(grantAndAcceptRole(contract, admin, nominee, role))
  })
  await Promise.all(promises)
}

export async function includeIfNotIncluded(
  signer: SignerWithAddress,
  list: Contract | SmockContractBase<Contract>,
  addresses: string[]
): Promise<void> {
  const promises: Promise<boolean>[] = []
  addresses.forEach((address) => {
    promises.push(list.isIncluded(address))
  })
  const results = await Promise.all(promises)
  const addressesNotIncluded: string[] = []
  results.forEach((result, index) => {
    if (!result) {
      addressesNotIncluded.push(addresses[index])
    }
  })
  if (addressesNotIncluded.length > 0) {
    await sendTxAndWait(
      await list
        .connect(signer)
        .set(addressesNotIncluded, new Array(addressesNotIncluded.length).fill(true))
    )
    console.log(
      `Following addresses were added to list at ${
        list.address
      }:\n${addressesNotIncluded.toString()}`
    )
  } else {
    console.log(`All addresses already included in list at ${list.address}`)
  }
}

export async function setSingleValueIfNotAlreadySet(
  signer: SignerWithAddress,
  contract: Contract | SmockContractBase<Contract>,
  value: string | BigNumber | number | boolean,
  getter: string,
  setter: string
): Promise<void> {
  if (BigNumber.isBigNumber(value) || typeof value === 'number') {
    if (!BigNumber.from(value).eq(await contract[getter]())) {
      await sendTxAndWait(await contract.connect(signer)[setter](value))
      console.log(setter, 'called with', value.toString())
    } else {
      console.log(getter, 'already returns', value.toString())
    }
  } else if ((await contract[getter]()) !== value) {
    await sendTxAndWait(await contract.connect(signer)[setter](value))
    console.log(setter, 'called with', value)
  } else {
    console.log(getter, 'already returns', value)
  }
}

export async function getRolesAccountIsNotNominatedFor(
  contract: Contract | SmockContractBase<Contract>,
  accountAddress: string,
  roles: string[]
): Promise<string[]> {
  const promises: Promise<boolean>[] = []
  roles.forEach((role) => {
    promises.push(contract.isNominated(role, accountAddress))
  })
  const results = await Promise.all(promises)
  const rolesAccountIsNotNominatedFor: string[] = []
  results.forEach((result, index) => {
    if (!result) {
      rolesAccountIsNotNominatedFor.push(roles[index])
    }
  })
  return rolesAccountIsNotNominatedFor
}

export async function grantRole(
  contract: Contract | SmockContractBase<Contract>,
  admin: SignerWithAddress,
  nomineeAddress: string,
  role: string
): Promise<void> {
  await contract.connect(admin).grantRole(role, nomineeAddress)
}

export async function batchGrantRoles(
  contract: Contract | SmockContractBase<Contract>,
  admin: SignerWithAddress,
  nomineeAddress: string,
  roles: string[]
): Promise<void> {
  const rolesAccountDoesNotHave = await getRolesAccountDoesNotHave(contract, nomineeAddress, roles)
  const rolesThatNeedGranting = await getRolesAccountIsNotNominatedFor(
    contract,
    nomineeAddress,
    rolesAccountDoesNotHave
  )
  const promises: Promise<void>[] = []
  rolesThatNeedGranting.forEach((role) => {
    promises.push(grantRole(contract, admin, nomineeAddress, role))
  })
  await Promise.all(promises)
}

export function getAcceptRoleSteps(
  network: Network,
  contract: Contract | SmockContractBase<Contract>,
  roles: string[]
): ProposalStep[] {
  const batchSteps: ProposalStep[] = []
  roles.forEach((role) => {
    batchSteps.push({
      contractId: `${network.defenderName}-${contract.address}`,
      type: 'custom',
      targetFunction: {
        name: 'acceptRole',
        inputs: [{ type: 'bytes32', name: 'role' }],
      },
      functionInputs: [role],
    })
  })
  return batchSteps
}

export function getAcceptOwnershipSteps(
  network: Network,
  contracts: Contract[] | SmockContractBase<Contract>[]
): ProposalStep[] {
  const batchSteps: ProposalStep[] = []
  contracts.forEach((contract) => {
    batchSteps.push({
      contractId: `${network.defenderName}-${contract.address}`,
      type: 'custom',
      targetFunction: {
        name: 'acceptOwnership',
        inputs: [],
      },
      functionInputs: [],
    })
  })
  return batchSteps
}

export function getRevokeRoleSteps(
  network: Network,
  roleHolderAddress: string,
  contract: Contract | SmockContractBase<Contract>,
  roles: string[]
): ProposalStep[] {
  const batchSteps: ProposalStep[] = []
  roles.forEach((role) => {
    batchSteps.push({
      contractId: `${network.defenderName}-${contract.address}`,
      type: 'custom',
      targetFunction: {
        name: 'revokeRole',
        inputs: [
          { type: 'bytes32', name: 'role' },
          { type: 'address', name: 'account' },
        ],
      },
      functionInputs: [role, roleHolderAddress],
    })
  })
  return batchSteps
}

/**
 * Typed only to accept Contract, not SmockContractBase<Contract> for now,
 * since the returned array cannot be assembled unless the type is guaranteed,
 * requiring duplication of code for each type.
 *
 * We aren't currently needing a function like this for testing, so going to
 * shelve finding a more elegant solution for now.
 */
export async function getContractsAccountIsNotRoleHolderOf(
  contracts: Contract[],
  accountAddress: string,
  role: string
): Promise<Contract[]> {
  const promises: Promise<boolean>[] = []
  contracts.forEach((contract) => {
    promises.push(contract.hasRole(role, accountAddress))
  })
  const results = await Promise.all(promises)
  const contractsAccountIsNotRoleHolderOf: Contract[] = []
  results.forEach((result, index) => {
    if (!result) {
      contractsAccountIsNotRoleHolderOf.push(contracts[index])
    }
  })
  return contractsAccountIsNotRoleHolderOf
}

export function generateDomainSeparator(
  name: string,
  version: string,
  chainId: number,
  verifyingContract: string
): string {
  return `0x${TypedDataUtils.hashStruct(
    'EIP712Domain',
    { name, version, chainId, verifyingContract },
    { EIP712Domain },
    SignTypedDataVersion.V4
  ).toString('hex')}`
}

export const utils = {
  expandToDecimals,
  expandTo6Decimals,
  expandTo18Decimals,
  nowPlusMonths,
  getZeroPadHexFromAddress,
  getLastTimestamp,
  setNextTimestamp,
  sendTxAndWait,
  isTestnetChain,
  assertIsTestnetChain,
  getDefenderAdminClient,
  recordDeployment,
  mineBlocks,
  mineBlock,
  getPermitSignature,
  generateLowerAddress,
  generateHigherAddress,
  grantAndAcceptRole,
  batchGrantAndAcceptRoles,
  getRolesAccountDoesNotHave,
  includeIfNotIncluded,
  setSingleValueIfNotAlreadySet,
  getRolesAccountIsNotNominatedFor,
  grantRole,
  batchGrantRoles,
  getAcceptRoleSteps,
  getAcceptOwnershipSteps,
  getRevokeRoleSteps,
  getContractsAccountIsNotRoleHolderOf,
  generateDomainSeparator,
}
