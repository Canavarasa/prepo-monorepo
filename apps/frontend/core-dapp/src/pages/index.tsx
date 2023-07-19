import { Routes } from '../lib/routes'
import { Redirect } from '../components/Redirect'
import TradePage from '../features/trade/TradePage'

const TradeMarketPage: React.FC = () => (
  <>
    <Redirect to={Routes.Trade} />
    {/* Render the trade page here too for a smooth transition */}
    <TradePage />
  </>
)

export default TradeMarketPage
