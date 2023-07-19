import { CaptureError, RootStoreOptions, StoreConfig } from './utils/stores.types'
import { normalizeStoreConfig } from './utils/stores-config-utils'
import { friendlyErrorMessageCapturer } from './utils/error-capturer-util'
import { Web3Store } from './Web3Store'
import { MulticallStore } from './MulticallStore'
import { BrowserStore } from './BrowserStore'
import { ClockStore } from './ClockStore'
import { ToastStore } from './ToastStore'

export class RootStore<SupportedContracts> {
  captureError: CaptureError
  toastStore: ToastStore
  browserStore: BrowserStore
  clockStore: ClockStore
  web3Store: Web3Store
  multicallStore: MulticallStore
  config: Required<StoreConfig<SupportedContracts>>

  constructor({ toast, storeConfig }: RootStoreOptions<SupportedContracts>) {
    this.captureError = friendlyErrorMessageCapturer
    this.config = normalizeStoreConfig<SupportedContracts>(storeConfig)
    this.toastStore = new ToastStore(this, toast)
    this.browserStore = new BrowserStore(this)
    this.clockStore = new ClockStore(this)
    this.web3Store = new Web3Store(this)
    this.multicallStore = new MulticallStore(this)
  }
}
