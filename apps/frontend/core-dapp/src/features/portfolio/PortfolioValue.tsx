import { Button, Flex, Grid, media, spacingIncrement, Tooltip } from 'prepo-ui'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import prepoLogoBgDark from './prepo-logo-bg-dark.svg'
import prepoLogoBgLight from './prepo-logo-bg-light.svg'
import BaseLidoApr from '../../components/LidoApr'
import Skeleton from '../../components/Skeleton'
import { displayEth } from '../../utils/number-utils'
import { useRootStore } from '../../context/RootStoreProvider'
import { Routes } from '../../lib/routes'
import {
  OpenPositions,
  PortfolioEthYield,
  PortfolioValue as PortfolioValueDefinition,
  PrePOBalance,
} from '../definitions'
import { TestIds } from '../../components/TestId'

const Container = styled(Flex)`
  background: url('${({ theme }): string =>
      (theme.isDarkMode ? prepoLogoBgDark : prepoLogoBgLight).src}')
    no-repeat center;
  background-size: cover;
  border-radius: ${spacingIncrement(16)};
  box-shadow: ${({ theme }): string => theme.shadow.prepo};
  height: fit-content;
  width: 100%;

  ${media.desktop`
    background-size: initial;
    background-position-y: top;
  `}
`
const Label = styled.span`
  color: ${({ theme }): string => theme.color.neutral3};
  cursor: default;
  font-size: ${spacingIncrement(14)};
  line-height: ${spacingIncrement(14)};
`

const Value = styled.span`
  color: ${({ theme }): string => theme.color.secondary};
  cursor: default;
  font-size: ${spacingIncrement(16)};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${spacingIncrement(16)};
`

const BigValue = styled(Value)`
  cursor: default;
  font-size: ${spacingIncrement(32)};
  line-height: ${spacingIncrement(34)};
`

const LidoApr = styled(BaseLidoApr)`
  cursor: default;
  font-size: ${spacingIncrement(24)};
  line-height: ${spacingIncrement(26)};
`

const ActionButton = styled(Button).attrs({
  type: 'text',
  size: 'xs',
})`
  &&& {
    div {
      color: ${({ theme }): string => theme.color.primaryLight};
      font-size: ${({ theme }): string => theme.fontSize.sm};
      font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
      line-height: ${spacingIncrement(14)};
      padding: 0;
    }
  }
`

const PortfolioValue: React.FC = () => {
  const { portfolioStore, collateralStore, web3Store } = useRootStore()
  const { portfolioValue, tradingPositionsValue } = portfolioStore
  const { balance } = collateralStore
  const { connected } = web3Store

  return (
    <Container p={16} flexDirection="column" alignItems="start" justifyContent="start" gap={24}>
      <Tooltip overlay={<PortfolioValueDefinition />}>
        <Flex flexDirection="column" alignItems="start" gap={4}>
          <Label>Portfolio Value</Label>
          {connected ? (
            <>
              {portfolioValue === undefined ? (
                <Skeleton width={120} height={34} />
              ) : (
                <Flex gap={4}>
                  <BigValue data-testid={TestIds.PortfolioTotalBalance}>
                    {displayEth(+portfolioValue)}
                  </BigValue>
                </Flex>
              )}
            </>
          ) : (
            <BigValue>-</BigValue>
          )}
        </Flex>
      </Tooltip>
      <Tooltip overlay={<PortfolioEthYield />}>
        <Flex flexDirection="column" alignItems="start" gap={4}>
          <Label>ETH Yield</Label>
          <Flex gap={4}>
            <LidoApr />
          </Flex>
        </Flex>
      </Tooltip>
      <Grid gridTemplateColumns="repeat(2, 1fr)" width="100%" gap={16}>
        <Tooltip overlay={<OpenPositions />}>
          <Flex flexDirection="column" alignItems="start" gap={4}>
            <Label>Open Positions</Label>
            {connected ? (
              <>
                {tradingPositionsValue === undefined ? (
                  <Skeleton width={54} height={16} />
                ) : (
                  <Flex gap={4}>
                    <Value>{displayEth(tradingPositionsValue)}</Value>
                  </Flex>
                )}
              </>
            ) : (
              <Value>-</Value>
            )}
          </Flex>
        </Tooltip>
        <Tooltip overlay={<PrePOBalance />}>
          <Flex flexDirection="column" alignItems="start" gap={4}>
            <Label>prePO Balance</Label>
            {connected ? (
              <>
                {balance === undefined ? (
                  <Skeleton width={54} height={16} />
                ) : (
                  <Flex gap={4}>
                    <Value>{displayEth(balance.inEth)}</Value>
                  </Flex>
                )}
              </>
            ) : (
              <Value>-</Value>
            )}
          </Flex>
        </Tooltip>
      </Grid>
      <Flex gap={16}>
        <ActionButton href={Routes.Deposit}>Deposit &rarr;</ActionButton>
        <ActionButton href={Routes.Withdraw}>Withdraw &rarr;</ActionButton>
      </Flex>
    </Container>
  )
}

export default observer(PortfolioValue)
