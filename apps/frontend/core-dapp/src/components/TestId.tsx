export enum TestIds {
  DepositSummaryMinReceived = 'deposit-summary-min-received',
  DepositSummarySlippage = 'deposit-summary-slippage',
  OpenTradeSummaryHeader = 'open-trade-summary-header',
  OpenTradeSummaryPpo = 'open-trade-summary-ppo',
  OpenTradeSummarySlippage = 'open-trade-summary-slippage',
  PortfolioTotalBalance = 'portfolio-total-balance',
  PpoBalance = 'ppo-balance',
  RulesScroll = 'rules-scroll',
  SettingsDropdownWallet = 'settings-dropdown-wallet',
  TermsScroll = 'terms-scroll',
  Toast = 'toast',
  WithdrawSummaryMinReceived = 'withdraw-summary-min-received',
  WithdrawSummarySlippage = 'withdraw-summary-slippage',
}

// Applies a test id to its children without altering the layout
// Useful when we can't apply test ids to components themselves
export const TestId: React.FC<{ id: string }> = ({ children, id }) => (
  <div data-testid={id} style={{ display: 'contents' }}>
    {children}
  </div>
)
