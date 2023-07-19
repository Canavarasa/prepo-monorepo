import { icon } from '../../utils'

export const networksIcons = {
  arbitrum: icon('Arbitrum', () => import('./Arbitrum')),
  binance: icon('Binance', () => import('./Binance')),
  ethereum: icon('Ethereum', () => import('./Ethereum')),
  polygon: icon('Polygon', () => import('./Polygon')),
}
