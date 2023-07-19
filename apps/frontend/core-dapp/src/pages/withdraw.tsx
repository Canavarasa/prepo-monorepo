import { Redirect } from '../components/Redirect'
import { Routes } from '../lib/routes'

// This is a legacy route that we used before launch
const WithdrawPage: React.FC = () => <Redirect to={Routes.Withdraw} />

export default WithdrawPage
