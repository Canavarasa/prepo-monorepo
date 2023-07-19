import { ethers } from 'hardhat'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import {
  TestUintValue,
  UniswapV3OracleUintValue,
  UniswapV3ToChainlinkOracleUintValue,
} from '../../types/generated'

export async function testUintValueFixture(): Promise<TestUintValue> {
  const factory = await ethers.getContractFactory('TestUintValue')
  return (await factory.deploy()) as TestUintValue
}

export async function smockTestUintValueFixture(): Promise<MockContract> {
  const mockFactory = await smock.mock('TestUintValue')
  return (await mockFactory.deploy()) as MockContract
}

export function fakeTestUintValueFixture(): Promise<FakeContract<TestUintValue>> {
  return smock.fake<TestUintValue>('TestUintValue')
}

export async function uniswapV3OracleUintValueFixture(
  uniswapOracle: string,
  uniswapBaseToken: string,
  uniswapQuoteToken: string
): Promise<UniswapV3OracleUintValue> {
  const factory = await ethers.getContractFactory('UniswapV3OracleUintValue')
  return (await factory.deploy(
    uniswapOracle,
    uniswapBaseToken,
    uniswapQuoteToken
  )) as UniswapV3OracleUintValue
}

export function fakeUniswapV3OracleUintValueFixture(): Promise<
  FakeContract<UniswapV3OracleUintValue>
> {
  return smock.fake<UniswapV3OracleUintValue>('UniswapV3OracleUintValue')
}

export function attachUniswapV3OracleUintValueFixture(
  address: string
): Promise<UniswapV3OracleUintValue> {
  return ethers.getContractAt(
    'UniswapV3OracleUintValue',
    address
  ) as Promise<UniswapV3OracleUintValue>
}

export async function uniswapV3ToChainlinkOracleUintValueFixture(
  uniswapOracle: string,
  uniswapBaseToken: string,
  uniswapQuoteToken: string,
  chainlinkOracle: string,
  chainlinkBaseToken: string,
  chainlinkQuoteToken: string,
  uniswapQuoteTokenDecimals: number,
  chainlinkBaseTokenDecimals: number
): Promise<UniswapV3ToChainlinkOracleUintValue> {
  const factory = await ethers.getContractFactory('UniswapV3ToChainlinkOracleUintValue')
  return (await factory.deploy(
    uniswapOracle,
    uniswapBaseToken,
    uniswapQuoteToken,
    chainlinkOracle,
    chainlinkBaseToken,
    chainlinkQuoteToken,
    uniswapQuoteTokenDecimals,
    chainlinkBaseTokenDecimals
  )) as UniswapV3ToChainlinkOracleUintValue
}
