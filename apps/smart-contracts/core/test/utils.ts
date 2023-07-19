import { parseEther } from '@ethersproject/units'
import { BigNumber, Contract, PopulatedTransaction } from 'ethers'
import { ethers, network } from 'hardhat'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { FakeContract, MockContract, SmockContractBase } from '@defi-wonderland/smock'
import { PERCENT_UNIT } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { expect } from 'chai'
import { id } from 'ethers/lib/utils'
import { IDepositTradeHelper } from '../types/generated'

const { getPermitSignature } = utils

export const DEFAULT_TIME_DELAY = 5

export function calculateFee(amount: BigNumber, factor: BigNumber): BigNumber {
  return amount.mul(factor).div(PERCENT_UNIT)
}

export function returnFromMockAPY(
  apy: number,
  timeElapsed: number,
  totalSupply: BigNumber
): BigNumber {
  const returnPerSecond = parseEther('1').mul(apy).div(100).div(31536000)
  const expectedShareValue = parseEther('1').add(returnPerSecond.mul(timeElapsed))
  return totalSupply.mul(expectedShareValue).div(parseEther('1'))
}

// calculate new amount after subtracting a percentage, represented as a 4 decimal place percent, i.e. 100% = 10000
export function subtractBps(amount: BigNumber, bps: number): BigNumber {
  return amount.sub(amount.mul(bps).div(10000))
}

export async function getLastTimestamp(): Promise<number> {
  /**
   * Changed this from ethers.provider.getBlockNumber since if evm_revert is used to return
   * to a snapshot, getBlockNumber will still return the last mined block rather than the
   * block height of the snapshot.
   */
  const currentBlock = await ethers.provider.getBlock('latest')
  return currentBlock.timestamp
}

export async function getLastBlockNumber(): Promise<number> {
  const currentBlock = await ethers.provider.getBlock('latest')
  return currentBlock.number
}

export function hashAddress(address: string): Buffer {
  return Buffer.from(ethers.utils.solidityKeccak256(['address'], [address]).slice(2), 'hex')
}

export function generateMerkleTree(addresses: string[]): MerkleTree {
  const leaves = addresses.map(hashAddress)
  return new MerkleTree(leaves, keccak256, { sortPairs: true })
}

export async function getSignerForContract(
  contract: Contract | MockContract | FakeContract
): Promise<SignerWithAddress> {
  /**
   * This gets the signer for a contract. The signer is needed to call
   * contract.connect(signer).functionName() to call a function on behalf of the contract.
   * This additionally funds the contract address with 1 eth for gas.
   */
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [contract.address],
  })
  const signer = await ethers.getSigner(contract.address)
  await network.provider.send('hardhat_setBalance', [
    contract.address,
    '0xde0b6b3a7640000', // 1 eth in hex
  ])
  return signer
}

export async function setAccountBalance(address: string, eth: string): Promise<void> {
  await network.provider.send('hardhat_setBalance', [
    address,
    ethers.utils.parseEther(eth).toHexString().replace('0x0', '0x'),
  ])
}

export async function getPermitFromSignature(
  token: Contract | SmockContractBase<Contract>,
  signer: SignerWithAddress,
  spender: string,
  value: BigNumber,
  deadline: number
): Promise<IDepositTradeHelper.PermitStruct> {
  const signature = await getPermitSignature(token, signer, spender, value, deadline)
  return <IDepositTradeHelper.PermitStruct>{
    deadline,
    v: signature.v,
    r: signature.r,
    s: signature.s,
  }
}

export async function testRoleConstants(roles: (Promise<string> | string)[]): Promise<void> {
  const roleTest = async (roleGetter: Promise<string>, roleConstant: string): Promise<void> => {
    expect(await roleGetter).eq(
      id(roleConstant),
      `Role constant does not match for ${roleConstant}`
    )
  }
  const tests: Promise<void>[] = []
  for (let i = 0; i < roles.length; i += 2) {
    const roleGetter = roles[i] as Promise<string>
    const roleConstant = roles[i + 1] as string
    tests.push(roleTest(roleGetter, roleConstant))
  }
  await Promise.all(tests)
}

export async function revertsIfNotRoleHolder(
  rolePromise: Promise<string>,
  populatedTransactionPromise: Promise<PopulatedTransaction>
): Promise<void> {
  const account = (await ethers.getSigners()).pop()
  const role = await rolePromise
  const populatedTransaction = await populatedTransactionPromise
  const contract = await ethers.getContractAt(
    'SafeAccessControlEnumerable',
    populatedTransaction.to
  )
  expect(await contract.hasRole(role, account.address)).eq(false)
  await expect(account.sendTransaction(populatedTransaction)).revertedWith(
    `AccessControl: account ${account.address.toLowerCase()} is missing role ${role}`
  )
}
