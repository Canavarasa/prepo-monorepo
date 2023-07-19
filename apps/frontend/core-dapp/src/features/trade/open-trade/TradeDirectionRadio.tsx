import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import { DirectionRadio } from '../../../components/DirectionRadio'
import { useRootStore } from '../../../context/RootStoreProvider'
import { Direction } from '../TradeStore'

const TradeDirectionRadio: React.FC = () => {
  const router = useRouter()
  const { tradeStore } = useRootStore()
  const { direction, selectedMarket } = tradeStore

  return (
    <DirectionRadio
      disabled={!selectedMarket}
      direction={direction}
      onChangeDirection={(newDirection: Direction): void => {
        if (newDirection === direction || !selectedMarket) return
        const tradeUrl = tradeStore.setDirection(newDirection)
        router.push(tradeUrl)
      }}
    />
  )
}

export default observer(TradeDirectionRadio)
