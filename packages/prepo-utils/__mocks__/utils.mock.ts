import { Network, METAMASK_INFURA_ID } from 'prepo-constants'

const mockData = {
  ethAddress: '0x1234000000000000000000000000000005678910',
  ethAddressShort: '0x1234...5678910',
  appName: 'my-app',
  goerliNetwork: {
    name: 'goerli',
    color: '#0975F6',
    chainId: 5,
    faucet: 'https://goerli-faucet.slock.it',
    blockExplorer: 'https://goerli.etherscan.io',
    rpcUrls: [`https://goerli.infura.io/v3/${METAMASK_INFURA_ID}`],
  } as Network,
  onboardObject: {
    networkId: 5,
    walletSelect: {
      wallets: [
        {
          walletName: 'metamask',
          preferred: true,
        },
        {
          walletName: 'ledger',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
          preferred: true,
        },
        {
          walletName: 'trezor',
          appUrl: 'https://prepo.io/',
          email: 'hello@prepo.io',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
          preferred: true,
        },
        {
          walletName: 'walletConnect',
          infuraKey: '460f40a260564ac4a4f4b3fffb032dad',
          preferred: true,
        },
        {
          walletName: 'coinbase',
          preferred: true,
        },
        {
          walletName: 'trust',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
          preferred: true,
        },
        {
          walletName: 'keepkey',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
        },
        {
          walletName: 'gnosis',
        },
        {
          walletName: 'liquality',
        },
        {
          walletName: 'authereum',
        },
        {
          walletName: 'lattice',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
          appName: 'my-app',
        },
        {
          walletName: 'opera',
        },
        {
          walletName: 'operaTouch',
        },
        {
          walletName: 'status',
        },
        {
          walletName: 'walletLink',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
          appName: 'my-app',
        },
        {
          walletName: 'imToken',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
        },
        {
          walletName: 'meetone',
        },
        {
          walletName: 'mykey',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
        },
        {
          walletName: 'huobiwallet',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
        },
      ],
    },
    walletCheck: [
      {
        checkName: 'derivationPath',
      },
      {
        checkName: 'accounts',
      },
      {
        checkName: 'connect',
      },
      {
        checkName: 'network',
      },
    ],
  },
  goerliUSDCContractAddress: '0xaFF4481D10270F50f203E0763e2597776068CBc5',
}

export default mockData
