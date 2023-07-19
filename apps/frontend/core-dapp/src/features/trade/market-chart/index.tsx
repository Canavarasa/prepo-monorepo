import { media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import Chart from './Chart'
import Timeframes from './Timeframe'
import Card from '../../../components/Card'
import { useRootStore } from '../../../context/RootStoreProvider'

const Wrapper = styled(Card)`
  width: 100%;
  ${media.largeDesktop`
    left: ${spacingIncrement(-16)};
    position: absolute;
    top: ${spacingIncrement(58)};
    transform: translateX(-100%);
    width: ${spacingIncrement(264)};
  `}

  &&& {
    .ant-card-body {
      display: flex;
      flex-direction: column;
      gap: ${spacingIncrement(12)};
      :before,
      :after {
        display: none;
      }
    }
  }
`

const Header = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`

const MarketChart: React.FC = () => {
  const { tradeStore } = useRootStore()
  const { selectedPosition, selectedMarket } = tradeStore

  return (
    <Wrapper>
      <Header>
        <Timeframes market={selectedMarket} />
      </Header>
      <Chart position={selectedPosition} />
    </Wrapper>
  )
}

export default observer(MarketChart)
