import { icon } from '../../utils'

export const currencyIcons = {
  lidoETH: icon('LidoETH', () => import('./LidoEth')),
  eth: icon('Eth', () => import('./EthIcon')),
  preeth: icon('PreEth', () => import('./PreEthIcon')),
  weth: icon('Weth', () => import('./WethIcon')),
}
