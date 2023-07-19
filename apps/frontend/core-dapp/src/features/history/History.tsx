import { observer } from 'mobx-react-lite'
import { Flex, Typography } from 'prepo-ui'
import HistoryTransaction, { HistoryTransactionSkeleton } from './HistoryTransaction'
import { useRootStore } from '../../context/RootStoreProvider'

const History: React.FC = () => {
  const {
    portfolioStore: { transactionHistory },
  } = useRootStore()

  if (transactionHistory?.length === 0)
    return (
      <Flex p={24} flexDirection="column">
        <Typography color="neutral3" mb={12} variant="text-regular-base">
          No transaction history.
        </Typography>
      </Flex>
    )

  return (
    <Flex position="relative" flexDirection="column" alignItems="start" p={16} gap={16}>
      {transactionHistory ? (
        transactionHistory.map((transaction) => (
          <HistoryTransaction transaction={transaction} key={transaction.id} />
        ))
      ) : (
        <>
          <HistoryTransactionSkeleton />
          <HistoryTransactionSkeleton />
          <HistoryTransactionSkeleton />
        </>
      )}
    </Flex>
  )
}

export default observer(History)
