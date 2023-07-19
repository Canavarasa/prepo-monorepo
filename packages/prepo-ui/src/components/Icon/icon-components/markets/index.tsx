import { icon } from '../../utils'

export const marketsIcons = {
  opensea: icon('OpenSeaIcon', () => import('./OpenSeaIcon')),
  spacex: icon('SpacexIcon', () => import('./SpacexIcon')),
  starknet: icon('StarknetIcon', () => import('./StarknetIcon')),
  stripe: icon('StripeIcon', () => import('./StripeIcon')),
  zapper: icon('ZapperIcon', () => import('./ZapperIcon')),
  zksync: icon('ZkSyncIcon', () => import('./ZkSyncIcon')),
}
