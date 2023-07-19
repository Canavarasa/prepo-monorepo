import { getAddress } from 'ethers/lib/utils'
import { SupportedNetworks } from './networks'

export type ImportantAddress = {
  [key in SupportedNetworks]?: string
}

export type ImportantKeywords =
  | 'GOVERNANCE'
  | 'USDC'
  | 'UNIV3_FACTORY'
  | 'UNIV3_ORACLE'
  | 'UNIV3_POSITION_MANAGER'
  | 'UNIV3_SWAP_ROUTER'
  | 'UNIV3_QUOTER'
  | 'PPO'
  | 'WETH'
  | 'WSTETH'
  | 'WSTETH_ETH_BALANCER_VAULT'

export type ImportantAddresses = {
  [key in ImportantKeywords]?: ImportantAddress
}

export const PREPO_ADDRESSES: ImportantAddresses = {
  GOVERNANCE: {
    arbitrumTestnet: '0x054CcD68A2aC152fCFB93a15b6F75Eea53DCD9E0',
    arbitrumOne: '0xe5011a7cc5CDA29F02CE341B2847B58abEFA7c26',
  },
  USDC: {
    // This is not an actual USDC contract, but an instance of MockBaseToken
    arbitrumTestnet: '0xD0778E8A78E95f612A95A3636141435253131103',
    arbitrumOne: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  },
  UNIV3_FACTORY: {
    arbitrumTestnet: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    arbitrumOne: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  },
  UNIV3_ORACLE: {
    arbitrumOne: '0xA8C2682a616cC8c5848d531793678D945388955f',
  },
  UNIV3_POSITION_MANAGER: {
    arbitrumTestnet: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    arbitrumOne: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  },
  UNIV3_SWAP_ROUTER: {
    arbitrumTestnet: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    arbitrumOne: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  },
  UNIV3_QUOTER: {
    arbitrumOne: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  PPO: {
    arbitrumOne: '0xB40DBBb7931Cfef8Be73AEEC6c67d3809bD4600B',
  },
  WETH: {
    arbitrumOne: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  WSTETH: {
    arbitrumOne: '0x5979D7b546E38E414F7E9822514be443A4800529',
  },
  WSTETH_ETH_BALANCER_VAULT: {
    arbitrumOne: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  },
}

export function getPrePOAddressForNetwork(
  keyword: keyof ImportantAddresses,
  network: SupportedNetworks,
  localAddress?: string
): string {
  // Handle local network
  if (network === 'hardhat' || network === 'ganache') {
    if (!localAddress)
      throw new Error(`Local network detected, but no local ${keyword} address was provided`)
    return getAddress(localAddress)
  }
  /**
   * Handle remote network
   *
   * Store each entry because TS compiler does not recognize check for
   * PREPO_ADDRESSES[keyword] or PREPO_ADDRESSES[keyword][network] being
   * undefined unless explicitly stored before the conditional statement.
   * While technically TS should, if using &&, should evaluate if
   * PREPO_ADDRESSES[keyword] is undefined before accessing [network] it
   * doesn't seem to work unless we use `.` notation.
   */
  const entryForKeyword = PREPO_ADDRESSES[keyword]
  if (entryForKeyword && entryForKeyword[network]) {
    const entryForKeywordAndNetwork = entryForKeyword[network]
    if (entryForKeywordAndNetwork) {
      return getAddress(entryForKeywordAndNetwork)
    }
  }
  throw new Error(`${keyword} not defined for the ${network} network`)
}
