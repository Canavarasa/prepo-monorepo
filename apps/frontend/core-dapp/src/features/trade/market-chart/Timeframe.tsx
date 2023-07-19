import { spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import Tabs from '../../../components/Tabs'
import { MarketEntity } from '../../../stores/entities/MarketEntity'
import { noSelect } from '../../../styles/noSelect.style'
import { ChartTimeframe } from '../../../types/market.types'
import { useRootStore } from '../../../context/RootStoreProvider'

type Props = { market?: MarketEntity }

const TabsWrapper = styled(Tabs)<{ disabled: boolean }>`
  &&&& {
    .ant-tabs-nav {
      margin-bottom: 0;
    }
    .ant-tabs-nav-operations {
      display: none;
    }
    .ant-tabs-tab {
      border: none;
      border-radius: ${({ theme }): string => theme.borderRadius['3xs']};
      cursor: ${({ disabled }): string => (disabled ? 'not-allowed' : 'pointer')};
      height: auto;
      padding: ${spacingIncrement(2)} ${spacingIncrement(6)};
      opacity: ${({ disabled }): number => (disabled ? 0.6 : 1)};
      transition: none;
      :first-child,
      :nth-last-child(2) {
        border-radius: ${({ theme }): string => theme.borderRadius['3xs']};
      }

      :hover {
        background-color: ${({ disabled, theme }): string =>
          disabled ? 'auto' : theme.color.purpleStroke};
      }
    }
    .ant-tabs-nav-list {
      gap: ${spacingIncrement(6)};
    }
    .ant-tabs-tab-btn {
      color: ${({ theme }): string => theme.color.neutral3};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
      line-height: ${spacingIncrement(16)};
      transition: none;
      ${noSelect}
    }
    .ant-tabs-tab-active {
      background-color: ${({ theme }): string => theme.color.primary};
      :hover {
        background-color: ${({ theme }): string => theme.color.primary};
      }
    }
  }
`

const timeframes = [
  ChartTimeframe.DAY,
  ChartTimeframe.WEEK,
  ChartTimeframe.MONTH,
  ChartTimeframe.YEAR,
  ChartTimeframe.ALL,
]

const Timeframes: React.FC<Props> = ({ market }) => {
  const { tradeStore } = useRootStore()
  return (
    <TabsWrapper
      disabled={!market}
      styles={{ activeTextWeight: 'medium' }}
      type="card"
      tab={timeframes.map((value) => ({ heading: value, value }))}
      onChange={(value) => tradeStore.setSelectedTimeframe(value as ChartTimeframe)}
    />
  )
}

export default observer(Timeframes)
