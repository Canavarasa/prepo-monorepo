import { observer } from 'mobx-react-lite'
import { spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import Link from '../../components/Link'
import SummaryRecord from '../../components/SummaryRecord'
import { useRootStore } from '../../context/RootStoreProvider'
import { compactNumber } from '../../utils/number-utils'
import { MarketExpiryDate, MarketExpiryPrice, MarketPriceRange } from '../definitions'
import { getFullDateShortenMonthFromMs } from '../../utils/date-utils'
import { OperationSummary } from '../../components/OperationSummary'
import { PREPO_ZKSYNC_MARKET_BLOG_POST } from '../../lib/constants'

const Header = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacingIncrement(8)};
`

const SimulateButton = styled.button<{ $visible: boolean }>`
  background: ${({ theme }): string => theme.color.accentPurple};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius['3xs']};
  color: ${({ theme }): string => theme.color.primaryLight};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.xs};
  padding: ${spacingIncrement(2)} ${spacingIncrement(6)};
  visibility: ${({ $visible }) => ($visible ? 'initial' : 'hidden')};

  :hover {
    opacity: 0.8;
  }
`

const MarketDetails: React.FC = () => {
  const { tradeStore } = useRootStore()
  const { selectedMarket, showSimulatorButton, toggleSimulatorOpen } = tradeStore

  if (!selectedMarket) return null

  const halfwayValuation =
    selectedMarket.ceilingValuation === undefined || selectedMarket.floorValuation === undefined
      ? undefined
      : (selectedMarket.ceilingValuation + selectedMarket.floorValuation) / 2

  const formatValuation = (valuation: number): string =>
    compactNumber(valuation, {
      showUsdSign: true,
      minDecimals: 0,
    })

  return (
    <OperationSummary
      key="summary"
      header={
        <Header>
          <span>Market details</span>
          <SimulateButton
            $visible={showSimulatorButton}
            onClick={(e) => {
              e.stopPropagation()
              toggleSimulatorOpen()
            }}
          >
            Simulate
          </SimulateButton>
        </Header>
      }
    >
      <SummaryRecord
        label="Price Range"
        loading={
          selectedMarket.ceilingValuation === undefined ||
          selectedMarket.floorValuation === undefined
        }
        tooltip={<MarketPriceRange />}
      >
        {selectedMarket.ceilingValuation !== undefined &&
          selectedMarket.floorValuation !== undefined &&
          `${formatValuation(selectedMarket.floorValuation)} - ${formatValuation(
            selectedMarket.ceilingValuation
          )}`}
      </SummaryRecord>

      <SummaryRecord
        label="Expiry Date"
        loading={selectedMarket.expiryTime === undefined}
        tooltip={
          selectedMarket.expiryTime !== undefined && (
            <MarketExpiryDate expiry={selectedMarket.expiryTime} />
          )
        }
      >
        {selectedMarket.expiryTime !== undefined && (
          <>{getFullDateShortenMonthFromMs(selectedMarket.expiryTime)}</>
        )}
      </SummaryRecord>

      <SummaryRecord
        label="Expiry Price"
        loading={halfwayValuation === undefined}
        tooltip={halfwayValuation !== undefined && <MarketExpiryPrice />}
      >
        {halfwayValuation !== undefined && <>{formatValuation(halfwayValuation)}</>}
      </SummaryRecord>

      {selectedMarket.settlementDocsLink && (
        <SummaryRecord label="Settlement">
          <Link href={selectedMarket.settlementDocsLink} target="_blank">
            Learn More ↗
          </Link>
        </SummaryRecord>
      )}
    </OperationSummary>
  )
}

export default observer(MarketDetails)
