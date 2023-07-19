import React, { useMemo } from 'react'
import { Flex, spacingIncrement } from 'prepo-ui'
import styled, { Color } from 'styled-components'
import { observer } from 'mobx-react-lite'
import Link from 'next/link'
import { ACTION_NAME, getTransactionMetadata } from './history-utils'
import PositionLabel from '../position/PositionLabel'
import { getDateTimeFromSeconds } from '../../utils/date-utils'
import { useRootStore } from '../../context/RootStoreProvider'
import { PositionName, MarketIcon as TransactionIcon } from '../position/Position'
import Skeleton from '../../components/Skeleton'
import { Routes } from '../../lib/routes'
import { absoluteNumberString, displayEth } from '../../utils/number-utils'
import { isProduction } from '../../utils/isProduction'
import { TransactionModelType } from '../../../generated/mst-gql/core-dapp'

type ButtonColors = {
  backgroundColor: keyof Color
  color: keyof Color
}

const buttonColors: { [key: string]: ButtonColors } = {
  WITHDRAW: {
    backgroundColor: 'accentWarning',
    color: 'warning',
  },
  DEPOSIT: {
    backgroundColor: 'accentWarning',
    color: 'warning',
  },
  OPEN: {
    backgroundColor: 'accentSuccess',
    color: 'success',
  },
  CLOSE: {
    backgroundColor: 'accentError',
    color: 'error',
  },
  REDEEM: {
    backgroundColor: 'accentError',
    color: 'error',
  },
}

const TransactionName = styled(PositionName).attrs({ as: 'a' })`
  :hover {
    color: ${({ theme }): string => theme.color.primaryLight};
  }
`

const Label = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  margin: 0;
`

const ActionLink = styled.a<{ $action: string }>`
  align-items: center;
  background: ${({ $action, theme }): string => theme.color[buttonColors[$action].backgroundColor]};
  border-radius: ${spacingIncrement(8)};
  color: ${({ $action, theme }): string => theme.color[buttonColors[$action].color]};
  display: flex;
  padding: ${spacingIncrement(2)} ${spacingIncrement(8)};
  white-space: nowrap;

  // Extend the color transition that exists globally on anchors
  transition: color 0.3s, background 0.3s;

  :hover {
    background: ${({ theme }): string => theme.color.accentPurple};
    color: ${({ theme }): string => theme.color.primaryLight};
  }
`

type Props = {
  transaction: Required<Partial<TransactionModelType>>
}

const HistoryTransaction: React.FC<Props> = ({ transaction }) => {
  const { web3Store } = useRootStore()
  const { network } = web3Store
  const { action, amount, createdAtTimestamp, hash, tokenAddress, contractAddress } = transaction

  // find relevant iconName, name, direction and etc to display
  const metadata = getTransactionMetadata(action, network.name, tokenAddress, contractAddress)

  const nameRedirectUrl = useMemo(() => {
    switch (action) {
      case 'DEPOSIT':
        return Routes.Deposit
      case 'WITHDRAW':
        return Routes.Withdraw
      default:
        return {
          pathname: Routes.Trade,
          query: {
            action: action === 'OPEN' ? 'open' : 'close',
            direction: metadata?.direction,
            marketId: metadata?.market?.urlId,
          },
        }
    }
  }, [action, metadata?.direction, metadata?.market?.urlId])

  // data mismatch across frontend and subgraph
  if (!metadata) {
    if (!isProduction) throw new Error('Data mismatch across frontend and subgraph')
    return null
  }

  return (
    <Flex justifyContent="start" gap={8} width="100%">
      <TransactionIcon
        name={metadata.iconName}
        height={spacingIncrement(48)}
        width={spacingIncrement(48)}
      />
      <Flex flexDirection="column" alignItems="start">
        <Flex gap={4}>
          <Link href={nameRedirectUrl} passHref>
            <TransactionName>{metadata.name}</TransactionName>
          </Link>

          {metadata.direction && <PositionLabel positionType={metadata.direction} />}
        </Flex>
        {/** amount can be negative value when closing, we need to make it absolute number while maintaing it's type as string
         * so in the future we can use a tooltip to show exact value without losing decimals
         */}
        <Label>{displayEth(+absoluteNumberString(amount))}</Label>
      </Flex>
      <Flex flexDirection="column" alignItems="end" ml="auto" gap={6}>
        <Link href={web3Store.getBlockExplorerUrl(hash as string)} passHref>
          <ActionLink $action={action as string} target="_blank" rel="noreferrer noopener nofollow">
            {ACTION_NAME[action as keyof typeof ACTION_NAME]} &#x02197;
          </ActionLink>
        </Link>
        <Label>{getDateTimeFromSeconds(createdAtTimestamp)}</Label>
      </Flex>
    </Flex>
  )
}

export const HistoryTransactionSkeleton: React.FC = () => (
  <Flex justifyContent="start" gap={8} width="100%" py={3}>
    <Skeleton circle height={48} width={48} />
    <Flex flexDirection="column" alignItems="start" gap={4}>
      <Skeleton height={22} width={80} />
      <Skeleton height={14} width={40} />
    </Flex>
    <Flex flexDirection="column" alignItems="end" ml="auto" gap={6}>
      <Skeleton height={22} width={90} />
      <Skeleton height={14} width={64} />
    </Flex>
  </Flex>
)

export default observer(HistoryTransaction)
