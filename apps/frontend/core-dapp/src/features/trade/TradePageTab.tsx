import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'

import { TradeAction } from './TradeStore'
import { useRootStore } from '../../context/RootStoreProvider'
import PageTabs from '../../components/PageTabs'
import { TabProps } from '../../components/Tabs'

const tabs: TabProps[] = [
  { value: 'open', heading: 'Open' },
  { value: 'close', heading: 'Close' },
]

const TradePageTab: React.FC = () => {
  const router = useRouter()
  const { tradeStore } = useRootStore()
  const { action, setAction, selectedPosition } = tradeStore

  const handleClick = (newAction: string): void => {
    if (newAction === action) return
    // don't select market when closing if user has no position in it
    if (newAction === 'close' && !selectedPosition?.hasPosition)
      tradeStore.setSelectedMarket(undefined)

    const tradeUrl = setAction(newAction as TradeAction)
    router.push(tradeUrl)
  }

  return (
    <PageTabs activeKey={action === 'close' ? 'close' : 'open'} onChange={handleClick} tab={tabs} />
  )
}

export default observer(TradePageTab)
