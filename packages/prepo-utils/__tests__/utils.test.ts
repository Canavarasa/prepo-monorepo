import { ChainId } from 'prepo-constants'
import { ethers } from 'ethers'
import * as utils from '../src'
// eslint-disable-next-line jest/no-mocks-import
import mockData from '../__mocks__/utils.mock'

const { getShortAccount, getNetworkByChainId, parseUnits } = utils
const { ethAddress, ethAddressShort, goerliNetwork } = mockData

// TODO: will need to deep compare the objects in future
describe('prepo-utils', () => {
  it('tests getShortAccount function', () => {
    const shorterAddress = getShortAccount(ethAddress)
    expect(shorterAddress).toEqual(ethAddressShort)
  })
  it('tests getNetworkByChainId function', () => {
    const network = getNetworkByChainId(ChainId.Goerli)
    expect(network.name).toEqual(goerliNetwork.name)
    expect(network.chainId).toEqual(goerliNetwork.chainId)
    expect(network.faucet).toEqual(goerliNetwork.faucet)
    expect(network.blockExplorer).toEqual(goerliNetwork.blockExplorer)
    expect(network.rpcUrls).toEqual(goerliNetwork.rpcUrls)
    expect(network.color).toEqual(goerliNetwork.color)
  })
  it('test formatNumber function', () => {
    const number = '123456789'
    const formattedNumber1 = utils.formatNumber(number, { compact: true })
    expect(formattedNumber1).toEqual('123M')
    const formattedNumber2 = utils.formatNumber(number, { usd: true })
    expect(formattedNumber2).toEqual('$123,456,789.00')
    const formattedNumber3 = utils.formatNumber(number, { compact: true, usd: true })
    expect(formattedNumber3).toEqual('$123M')
  })
})

describe('# parseUnits', () => {
  describe('decimals', () => {
    it('returns undefined if decimals undefined', () => {
      const output = parseUnits('100', undefined)
      expect(output).toBe(undefined)
    })

    it('returns correct BigNumber if valid decimals', () => {
      const output = parseUnits('100', 6)
      expect(output.eq(ethers.utils.parseUnits('100', 6))).toBe(true)
    })
  })

  describe('integer part', () => {
    it('returns 0 BigNumber if empty string', () => {
      const output = parseUnits('', 6)
      expect(output.eq(ethers.utils.parseUnits('0', 6))).toBe(true)
    })

    it('returns correct BigNumber if valid integer only input', () => {
      const result = parseUnits('1', 6)
      expect(result.eq(ethers.utils.parseUnits('1', 6))).toBe(true)
    })

    it('returns undefined if non-number in integer part', () => {
      const output = parseUnits('abcd1234', 6)
      expect(output).toBe(undefined)
    })

    it('returns undefined if comma in integer part', () => {
      const output = parseUnits('12,34', 6)
      expect(output).toBe(undefined)
    })
  })

  describe('fraction part', () => {
    it('returns correct BigNumber if valid fraction only input', () => {
      const result = parseUnits('0.1', 6)
      expect(result.eq(ethers.utils.parseUnits('0.1', 6))).toBe(true)
    })

    it('returns BigNumber capped at specified decimals if more fraction digits than decimals', () => {
      const output = parseUnits('0.1234567890', 6)
      expect(output.eq(ethers.utils.parseUnits('0.123456', 6))).toBe(true)
    })

    it('returns undefined if fraction contains non-number character', () => {
      const output = parseUnits('0.1234567890a', 6)
      expect(output).toBe(undefined)
    })
  })

  describe('integer + fraction', () => {
    it('returns correct BigNumber if valid full input', () => {
      const result = parseUnits('1.23', 6)
      expect(result.eq(ethers.utils.parseUnits('1.23', 6))).toBe(true)
    })

    it('returns undefined if non-numbers in integer and fraction parts', () => {
      const output = parseUnits('12a.34b', 6)
      expect(output).toBe(undefined)
    })
  })
})
