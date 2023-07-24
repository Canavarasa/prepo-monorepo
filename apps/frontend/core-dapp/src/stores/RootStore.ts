import { RootStore as PRootStore, LocalStorageStore } from 'prepo-stores'
import { ThemeModes, toast } from 'prepo-ui'
import { UiStore } from './UiStore'
import { MarketStore } from './MarketStore'
import { TokensStore } from './TokensStore'
import { Erc20Store } from './entities/Erc20.entity'
import { CollateralStore } from './CollateralStore'
import { storeConfig } from './utils/stores-config'
import { UniswapRouterStore } from './UniswapRouterStore'
import { CoreGraphStore } from './graphs/CoreGraphStore'
import { TimerStore } from './TimerStore'
import { UniswapV3GraphStore } from './graphs/UniswapV3GraphStore'
import { SwapStore } from './SwapStore'
import { DepositRecordStore } from './DepositRecordStore'
import { MediaQueryStore } from './MediaQueryStore'
import { DepositTradeHelperStore } from './DepositTradeHelperStore'
import { BalancerStore } from './BalancerStore'
import { BalancerVaultStore } from './BalancerVaultStore'
import { MetaStablePool } from './MetaStablePoolStore'
import { LidoStore } from './LidoStore'
import { GasStore } from './GasStore'
import { ResourceStore } from './ResourceStore'
import { TradeStore } from '../features/trade/TradeStore'
import { AdvancedSettingsStore } from '../components/AdvancedSettingsModal/AdvancedSettingsStore'
import { DepositStore } from '../features/deposit/DepositStore'
import { FilterStore } from '../components/Filter/FilterStore'
import { PROJECT_NAME } from '../lib/constants'
import { WithdrawStore } from '../features/withdraw/WithdrawStore'
import { SupportedContracts } from '../lib/contract.types'
import { PortfolioStore } from '../features/portfolio/PortfolioStore'
import config from '../lib/config'
import { TermsStore } from '../features/terms/TermsStore'
import { CloseTradeStore } from '../features/trade/close-trade/CloseTradeStore'
import { OpenTradeStore } from '../features/trade/open-trade/OpenTradeStore'

type LocalStorage = {
  isPortfolioVisible: boolean
  forcedTheme: ThemeModes | undefined
  selectedWallet: string | undefined

  // don't use Record here so it's clearer which key should use what value
  agreedTerms?: {
    [termsVersion: string]: {
      [address: string]: boolean
    }
  }
  agreedRules?: {
    [rulesVersion: string]: {
      [address: string]: boolean
    }
  }
}

const initLocalStorage: LocalStorage = {
  isPortfolioVisible: true,
  forcedTheme: undefined,
  selectedWallet: undefined,
  agreedTerms: {
    [config.termsVersion]: {},
  },
  agreedRules: {
    [config.rulesVersion]: {},
  },
}

export class RootStore extends PRootStore<SupportedContracts> {
  resourceStore: ResourceStore
  uiStore: UiStore
  localStorageStore: LocalStorageStore<LocalStorage>
  closeTradeStore: CloseTradeStore
  openTradeStore: OpenTradeStore
  tradeStore: TradeStore
  timerStore: TimerStore
  termsStore: TermsStore
  depositStore: DepositStore
  depositRecordStore: DepositRecordStore
  depositTradeHelperStore: DepositTradeHelperStore
  marketStore: MarketStore
  advancedSettingsStore: AdvancedSettingsStore
  baseTokenStore: Erc20Store
  portfolioStore: PortfolioStore
  collateralStore: CollateralStore
  uniswapRouterStore: UniswapRouterStore
  filterStore: FilterStore
  coreGraphStore: CoreGraphStore
  uniswapV3GraphStore: UniswapV3GraphStore
  withdrawStore: WithdrawStore
  swapStore: SwapStore
  tokensStore: TokensStore
  ppoTokenStore: Erc20Store
  mediaQueryStore: MediaQueryStore
  balancerStore: BalancerStore
  balancerVaultStore: BalancerVaultStore
  wstEthWethPool: MetaStablePool
  wethStore: Erc20Store
  lidoStore: LidoStore
  gasStore: GasStore

  constructor() {
    super({ toast, storeConfig })

    if (process.env.NODE_ENV !== 'test') {
      /* eslint-disable no-console */
      console.log(`build: ${process.env.NEXT_PUBLIC_PREPO_BUILD_ID ?? '-'}`)
      console.log(`build time: ${process.env.NEXT_PUBLIC_PREPO_BUILD_TIME ?? '-'}`)
      // TODO this is just to force redeployment - remove on next PR
      console.log('Deployed from IPFS node.')
      /* eslint-enable no-console */
    }

    this.gasStore = new GasStore(this)
    this.swapStore = new SwapStore(this)
    this.localStorageStore = new LocalStorageStore(this, `prepo.${PROJECT_NAME}`, initLocalStorage)
    this.timerStore = new TimerStore()
    this.termsStore = new TermsStore(this)
    this.uiStore = new UiStore(this)
    this.resourceStore = new ResourceStore(this)
    this.wethStore = new Erc20Store({
      root: this,
      tokenName: 'WETH',
      symbolOverride: 'WETH',
    })
    this.baseTokenStore = new Erc20Store({
      root: this,
      tokenName: 'WSTETH',
      symbolOverride: 'wstETH',
    })
    this.balancerVaultStore = new BalancerVaultStore(this)
    this.balancerStore = new BalancerStore(this)
    this.collateralStore = new CollateralStore(this)
    this.tokensStore = new TokensStore(this)
    this.portfolioStore = new PortfolioStore(this)
    this.depositStore = new DepositStore(this)
    this.depositRecordStore = new DepositRecordStore(this)
    this.depositTradeHelperStore = new DepositTradeHelperStore(this)
    this.withdrawStore = new WithdrawStore(this)
    this.tradeStore = new TradeStore(this)
    this.marketStore = new MarketStore(this)
    this.closeTradeStore = new CloseTradeStore(this)
    this.openTradeStore = new OpenTradeStore(this)
    this.advancedSettingsStore = new AdvancedSettingsStore(this)
    this.uniswapRouterStore = new UniswapRouterStore(this)
    this.filterStore = new FilterStore(this)
    this.coreGraphStore = new CoreGraphStore(this)
    this.uniswapV3GraphStore = new UniswapV3GraphStore(this)
    this.ppoTokenStore = new Erc20Store({ root: this, tokenName: 'PPO', symbolOverride: 'PPO' })
    this.mediaQueryStore = new MediaQueryStore()
    this.wstEthWethPool = new MetaStablePool(this)
    this.lidoStore = new LidoStore()
  }
}
