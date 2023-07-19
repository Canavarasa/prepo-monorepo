import { Redirect } from '../components/Redirect'
import { Routes } from '../lib/routes'

// This is a legacy route that we used before launch
const DepositPage: React.FC = () => <Redirect to={Routes.Deposit} />

export default DepositPage
