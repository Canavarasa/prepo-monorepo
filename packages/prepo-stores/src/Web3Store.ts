import { runInAction, makeAutoObservable, autorun, reaction } from 'mobx'
import { BigNumber, ethers } from 'ethers'
import { isAddress } from 'ethers/lib/utils'
import type { OnboardAPI, WalletState } from '@web3-onboard/core'
import { Network, IS_BROWSER, NETWORKS, SupportedNetworks } from 'prepo-constants'
import { chainIdToHexString } from 'prepo-utils'
import { RootStore } from './RootStore'
import { TransactionReceipt } from './utils/stores.types'
import { isImportantError } from './utils/error-capturer-util'
import { createFallthroughProvider } from './utils/createFallthroughProvider'
import {
  FallthroughProvider,
  StaticJsonRpcBatchProvider,
  TenderlyRpcProvider,
} from './utils/CustomProviders'

type SignerState = {
  address: string | undefined
  balance: BigNumber | undefined
  isContract: boolean
}

type Ens = WalletState['accounts'][number]['ens']

export class Web3Store {
  root: RootStore<unknown>
  blockNumber: number | undefined = undefined
  currentNetworkId?: number
  coreProvider: FallthroughProvider
  signer: ethers.providers.JsonRpcSigner | undefined = undefined
  signerState: SignerState = {
    address: undefined,
    balance: undefined,
    isContract: false,
  }
  unsubscribeFromWalletChange: (() => void) | undefined = undefined
  connecting = false
  onboardEns: Ens | undefined = undefined
  customRpc: Partial<Record<SupportedNetworks, string>> = {}

  private readonly onboard: Promise<OnboardAPI>
  isSafeWallet = false
  walletState?: WalletState

  constructor(root: RootStore<unknown>) {
    this.root = root
    this.coreProvider = createFallthroughProvider(root.config.defaultNetwork)
    makeAutoObservable(this, {}, { autoBind: true })

    this.onboard = Promise.all([import('@web3-onboard/core'), this.root.config.onboardConfig]).then(
      ([{ default: Onboard }, onboardConfig]) => Onboard(onboardConfig)
    )

    this.initCustomRpc()

    Web3Store.detectSafeWallet()
      .then((isSafeWallet) => {
        this.isSafeWallet = isSafeWallet
      })
      .then(() => this.onboard)
      .then(this.init)
      .catch(() => {
        this.root.toastStore.errorToast(
          'Wallet detection error. Please try again later.',
          Error(`Something went wrong`)
        )
      })
  }

  init(): void {
    if (!IS_BROWSER) return
    // If user has connected before, connect to their previous wallet
    const previouslySelectedWallet = window.localStorage.getItem('selectedWallet')
    if (previouslySelectedWallet) {
      this.connect(previouslySelectedWallet)
    } else if (this.isSafeWallet) {
      this.connect('Safe')
    }

    this.initProvider()

    // Refetch state immediately when tab switches from inactive to active
    // (check multicallStore exists so we don't exec this on mount)
    autorun(() => {
      if (!this.root.browserStore.tabIsInactive && this.root.multicallStore) {
        this.refreshChainState()
      }
    })
  }

  get currentRpcUrl(): string | undefined {
    return this.customRpc[this.network.name]
  }

  private initCustomRpc(): void {
    if (!IS_BROWSER) return
    const customRpc = window.localStorage.getItem('rpcs')
    if (customRpc) this.customRpc = JSON.parse(customRpc)
    this.updateCustomRpc(this.currentRpcUrl)

    // sync custom rpc with provider on network change
    reaction(
      () => this.network,
      () => this.updateCustomRpc(this.currentRpcUrl)
    )
  }

  private updateCustomRpc(rpcUrl?: string): void {
    if (rpcUrl) {
      this.cleanUpProvider()

      const provider = rpcUrl.startsWith('https://rpc.vnet.tenderly.co')
        ? new TenderlyRpcProvider(rpcUrl, this.network.chainId)
        : new StaticJsonRpcBatchProvider(rpcUrl, this.network.chainId)

      this.coreProvider.setCustomProvider(provider)
      this.initProvider()
    } else {
      this.coreProvider.setCustomProvider()
    }
  }

  // pass undefined to url to use default rpc
  setRpcUrl(chainName: SupportedNetworks, url?: string): void {
    // store custom rpc url by chain name
    this.customRpc[chainName] = url
    window.localStorage.setItem('rpcs', JSON.stringify(this.customRpc))
    this.updateCustomRpc(url)
  }

  private initProvider(): void {
    // Init event listeners
    this.coreProvider.on('block', this.handleNewBlock.bind(this))
  }

  private cleanUpProvider(): void {
    this.coreProvider.removeAllListeners()
  }

  handleNewBlock(n: number): void {
    if (this.root.browserStore.tabIsInactive) return
    try {
      this.blockNumber = n
      this.refreshChainState()
    } catch (error) {
      this.root.toastStore.errorToast('Error handling new block', error)
    }
  }

  wait(hash: string): Promise<TransactionReceipt> {
    return this.coreProvider.waitForTransaction(hash)
  }

  refreshChainState(): void {
    this.refreshSignerBalance()
    this.root.multicallStore.call()
  }

  get supportedNetworkIds(): { [key: number]: Network } {
    const supportedIds: { [key: number]: Network } = {}
    this.root.config.supportedNetworks.forEach((network) => {
      supportedIds[network.chainId] = network
    })
    return supportedIds
  }

  get isNetworkSupported(): boolean {
    if (this.currentNetworkId === undefined) return true
    return Boolean(this.supportedNetworkIds[this.currentNetworkId])
  }

  getBlockExplorerUrl(hash: string): string {
    const type = isAddress(hash) ? 'address' : 'tx'
    let explorer = NETWORKS[this.network.name].blockExplorer
    if (explorer[explorer.length - 1] === '/') explorer = explorer.slice(0, -1)

    return `${explorer}/${type}/${hash}`
  }

  private async refreshSignerBalance(): Promise<void> {
    try {
      if (!this.signerState.address) return
      const balance = await this.coreProvider.getBalance(this.signerState.address)
      runInAction(() => {
        this.signerState.balance = balance
      })
    } catch (error) {
      if (isImportantError(error))
        this.root.toastStore.errorToast('Error refreshing wallet balance', error)
    }
  }

  private async refreshSignerAddress(): Promise<void> {
    try {
      if (!this.signer) return
      const address = await this.signer.getAddress()
      runInAction(() => {
        this.signerState.address = address
      })
    } catch (error) {
      window.localStorage.removeItem('selectedWallet')
      this.root.toastStore.errorToast('Error fetching signer address', error)
    }
  }

  private async refreshSignerIsContract(): Promise<void> {
    try {
      if (!this.signer) return
      const address = await this.signer.getAddress()
      const code = await this.signer.provider.getCode(address)
      runInAction(() => {
        // Technically, a contract could have empty bytecode and trick us into
        // thinking it is an EOA, but that isn't useful so there's no reason for
        // anyone to do it.
        this.signerState.isContract = code !== '0x'
      })
    } catch (error) {
      runInAction(() => {
        this.signerState.isContract = false
      })
    }
  }

  async connect(walletName?: string): Promise<void> {
    if (this.connecting) return
    this.connecting = true
    try {
      const onboard = await this.onboard

      const walletState: WalletState[] = await onboard.connectWallet(
        walletName
          ? {
              autoSelect: {
                label: walletName,
                disableModals: walletName === 'Safe',
              },
            }
          : undefined
      )

      // Onboard wallet connection successful
      if (walletState.length) {
        this.handleConnected(walletState)

        await this.setNetwork(this.network)
        if (this.unsubscribeFromWalletChange) this.unsubscribeFromWalletChange()

        const walletsSub = onboard.state.select('wallets')
        this.unsubscribeFromWalletChange = walletsSub.subscribe(this.handleConnected).unsubscribe
        return
      }

      // Something went wrong connecting the wallet
      await this.disconnect()
    } catch (e) {
      await this.disconnect()
      const error = this.root.captureError(e)
      this.root.toastStore.errorToast('Error connecting wallet', error.message)
    } finally {
      runInAction(() => {
        this.connecting = false
      })
    }
  }

  handleConnected(walletState: WalletState[]): void {
    if (!walletState || !walletState.length) {
      this.disconnect()
      return
    }
    const [wallet] = walletState
    const { ens } = wallet.accounts[0]
    const { id } = wallet.chains[0]
    const walletProvider = new ethers.providers.Web3Provider(wallet.provider)
    const signer = walletProvider.getSigner()

    this.coreProvider.setWalletProvider(walletProvider)
    window.localStorage.setItem('selectedWallet', wallet.label)
    this.walletState = wallet
    this.signer = signer
    this.currentNetworkId = +id
    this.refreshSignerAddress()
    this.refreshSignerBalance()
    this.refreshSignerIsContract()
    if (this.onboardEns?.name !== ens?.name) this.onboardEns = ens
  }

  async disconnect(): Promise<void> {
    const onboard = await this.onboard
    this.signer = undefined
    this.currentNetworkId = undefined
    this.signerState = {
      address: undefined,
      balance: undefined,
      isContract: false,
    }
    this.coreProvider.setWalletProvider()
    window.localStorage.removeItem('selectedWallet')
    this.walletState = undefined
    this.connecting = false
    const { wallets } = onboard.state.get()
    if (!wallets.length) {
      return
    }
    await onboard.disconnectWallet({ label: wallets[0].label })
  }

  async checkSigner(): Promise<boolean> {
    return !!(await this.onboard)?.state?.get().wallets.length
  }

  async setNetwork(network: Network): Promise<void> {
    await (await this.onboard)?.setChain({ chainId: chainIdToHexString(network.chainId) })
  }

  get address(): string | undefined {
    return this.signerState.address
  }

  get connected(): boolean {
    return Boolean(this.signerState.address)
  }

  get network(): Network {
    if (this.currentNetworkId === undefined) return this.root.config.defaultNetwork
    return this.supportedNetworkIds[this.currentNetworkId] ?? this.root.config.defaultNetwork
  }

  private static async detectSafeWallet(): Promise<boolean> {
    try {
      // If we're not running in an iframe, we're not running inside Safe Wallet
      if (typeof window === 'undefined' || window.self === window.top) return false

      const { default: SafeAppsSDK } = await import('@safe-global/safe-apps-sdk')
      const sdk = new SafeAppsSDK()

      const safe = await Promise.race([
        sdk.safe.getInfo(),
        new Promise<undefined>((resolve) => {
          setTimeout(resolve, 200)
        }),
      ])

      return !!safe
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[prePO] Couldn't detect whether we're running inside Safe", e)
      return false
    }
  }
}
