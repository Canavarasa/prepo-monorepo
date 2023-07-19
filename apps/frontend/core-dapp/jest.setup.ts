/* eslint-disable max-classes-per-file,class-methods-use-this */
import { BigNumber } from 'ethers'
import { configure } from 'mobx'
import { ThemeModes } from 'prepo-ui/src/themes/themes.types'
import { initializeStore } from './src/context/initializeStore'

jest.mock('prepo-ui', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))
jest.mock('./src/stores/MarketStore')
jest.mock('./src/stores/MediaQueryStore', () => ({
  MediaQueryStore: class {
    get systemThemeMode(): ThemeModes {
      return ThemeModes.Light
    }
  },
}))
jest.mock('./src/stores/LidoStore', () => ({
  LidoStore: class {
    get apr(): string {
      return '5.0%'
    }
  },
}))

// This is needed to be able to mock mobx @computed properties on a class
configure({ safeDescriptors: false })

const rootStore = initializeStore()

const signerAddressMock = '0x1234000000000000000000000000000000000000'
const signerBalance = BigNumber.from(10)

jest.spyOn(rootStore.web3Store, 'signerState', 'get').mockReturnValue({
  address: signerAddressMock,
  balance: signerBalance,
  isContract: false,
})

jest.spyOn(rootStore.collateralStore, 'decimals').mockReturnValue([18])
jest.spyOn(rootStore.baseTokenStore, 'decimals').mockReturnValue([18])

global.rootStore = rootStore
