import { SupportedNetworks } from 'prepo-constants'

const config = {
  HOST: process.env.NEXT_PUBLIC_HOST ?? 'http://localhost:3000',
  NETWORK: (process.env.NEXT_PUBLIC_NETWORK as unknown as SupportedNetworks) ?? 'localhost',
  ROUNDED_DECIMALS: 4,
}

const appConfig = {
  isProduction: !config.HOST.includes('localhost'),
  // increase these versions if we change terms or rules to trigger a new "agree to terms" flow
  termsVersion: '1.0.0',
  rulesVersion: '1.0.0',
}

export default { ...config, ...appConfig }
