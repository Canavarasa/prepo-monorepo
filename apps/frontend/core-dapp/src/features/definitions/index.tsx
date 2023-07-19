import React from 'react'
import styled from 'styled-components'
import Link from '../../components/Link'
import { DateTimeInMs } from '../../utils/date-types'
import { formatDateTimePrecise } from '../../utils/date-utils'

const LearnMore: React.FC<{ link: string }> = ({ link }) => (
  <Link target="_blank" href={link}>
    Learn More ↗
  </Link>
)

const Paragraph = styled.p`
  margin: 0;
`

export const DepositReceived: React.FC = () => (
  <Paragraph>
    Estimated ETH value credited to your prePO account (Fee already subtracted).
  </Paragraph>
)

export const DepositWithdrawFee: React.FC<{ rebated: boolean }> = ({ rebated }) => (
  <Paragraph>{`Estimated fee${rebated ? ', rebated via PPO Reward' : ''}.`}</Paragraph>
)

export const WithdrawReceived: React.FC = () => (
  <Paragraph>Estimated ETH received in your wallet (Fee already subtracted).</Paragraph>
)

export const EstimatedValuation: React.FC = () => (
  <Paragraph>Estimated valuation price for this trade after factoring in Price Impact.</Paragraph>
)

export const EstimateYourProfitLoss: React.FC = () => (
  <Paragraph>Profit/loss upon closing position compared to average entry price.</Paragraph>
)

export const SlippageProtection: React.FC = () => (
  <Paragraph>Max price change allowed from transaction start to execution.</Paragraph>
)

export const EstimatedTradeFee: React.FC = () => (
  <Paragraph>Estimated fee for this trade.</Paragraph>
)

export const PPOReward: React.FC = () => (
  <Paragraph>
    Estimated PPO amount received immediately as a rebate incentive. PPO is prePO&apos;s governance
    and utility token. <LearnMore link="https://docs.prepo.io/faq#token" />
  </Paragraph>
)

export const EthYield: React.FC = () => (
  <Paragraph>
    Your ETH will be automatically converted into Lido Wrapped Staked ETH (wstETH) before being
    deposited, in order to earn you staking yield. <LearnMore link="https://lido.fi" />
  </Paragraph>
)

export const PortfolioEthYield: React.FC = () => (
  <Paragraph>
    Estimated Annual Percentage Return from Lido Wrapped Staked ETH (wstETH), automatically earned
    in the background on your entire Portfolio Value. <LearnMore link="https://lido.fi" />
  </Paragraph>
)

export const PrePOBalance: React.FC = () => (
  <Paragraph>
    Your deposited prePO ETH balance that isn&apos;t being used in any position yet.
  </Paragraph>
)

export const OpenPositions: React.FC = () => (
  <Paragraph>Total ETH value of all your open positions in prePO markets.</Paragraph>
)

export const PortfolioValue: React.FC = () => (
  <Paragraph>Open Positions + prePO Balance, inclusive of accumulated ETH Yield</Paragraph>
)

export const Simulator: React.FC = () => (
  <Paragraph>
    Simulate your theoretical PnL in the selected market for different entry and exit prices. All
    values exclude fees, yield, and rewards. Simulator prices are not your actual trade prices.
  </Paragraph>
)

export const SimulatorEstimatedProfit: React.FC = () => (
  <Paragraph>Theoretical profit if you enter and exit at your selected prices.</Paragraph>
)

export const SimulatorEstimatedLoss: React.FC = () => (
  <Paragraph>Theoretical loss if you enter and exit at your selected prices.</Paragraph>
)

export const SimulatorMaxProfit: React.FC = () => (
  <Paragraph>
    Theoretical profit if you enter at your selected price and exit at the best possible price.
  </Paragraph>
)

export const MaxProfit: React.FC = () => (
  <Paragraph>Theoretical profit if position closed at best possible price.</Paragraph>
)

export const SimulatorMaxLoss: React.FC = () => (
  <Paragraph>
    Theoretical loss if you enter at your selected price and exit at the worst possible price.
  </Paragraph>
)

export const MaxLoss: React.FC = () => (
  <Paragraph>Theoretical loss if position closed at worst possible price.</Paragraph>
)

export const SimulatorPnl: React.FC = () => (
  <Paragraph>
    Estimated profit/loss if position closed at selected Exit price, excluding fees and rewards.
  </Paragraph>
)

export const RedemptionFinalPrice: React.FC = () => (
  <Paragraph>Final post-fee settlement price for this position.</Paragraph>
)

export const MarketPriceRange: React.FC = () => (
  <Paragraph>Lower and upper bounds of where market price can trade.</Paragraph>
)

export const MarketExpiryDate: React.FC<{ expiry: DateTimeInMs }> = ({ expiry }) => (
  <Paragraph>
    Market settles at Expiry Price if not public by {formatDateTimePrecise(expiry)}
  </Paragraph>
)

export const MarketExpiryPrice: React.FC = () => (
  <Paragraph>Settlement price if asset not public before Expiry Date.</Paragraph>
)

export const TradePriceImpact: React.FC = () => (
  <Paragraph>Impact of your trade on market price.</Paragraph>
)

export const DepositAndTradePriceImpact: React.FC = () => (
  <Paragraph>Impact of your transaction on wstETH and market prices.</Paragraph>
)

export const GasCost: React.FC = () => <Paragraph>Estimated gas cost of transaction.</Paragraph>
