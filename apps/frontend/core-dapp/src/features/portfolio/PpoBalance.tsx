import React from 'react'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { Flex, spacingIncrement } from 'prepo-ui'
import PpoAmount from '../../components/PpoAmount'
import { useRootStore } from '../../context/RootStoreProvider'
import { TestIds } from '../../components/TestId'

const Wrapper = styled(Flex).attrs({ gap: 4 })`
  align-items: start;
  background: linear-gradient(252.55deg, rgba(98, 100, 217, 0.1) 0%, rgba(98, 100, 217, 0) 100%);
  border-radius: ${spacingIncrement(16)};
  box-shadow: ${({ theme }): string => theme.shadow.prepo};
  flex-direction: column;
  padding: ${spacingIncrement(16)};
  width: 100%;
`

const Label = styled.span`
  font-size: ${spacingIncrement(14)};
  font-style: normal;
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: ${spacingIncrement(14)};
`

const BigValue = styled.span`
  font-size: ${spacingIncrement(32)};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${spacingIncrement(34)};
`

const PpoBalance: React.FC = () => {
  const {
    ppoTokenStore: { tokenBalanceFormat },
    web3Store: { connected },
  } = useRootStore()

  return (
    <Wrapper>
      <Label>Your PPO Balance</Label>
      {connected ? (
        <BigValue data-testid={TestIds.PpoBalance}>
          <PpoAmount
            amount={tokenBalanceFormat}
            iconSize="32"
            iconSpacing={4}
            signDisplay="never"
            loading={tokenBalanceFormat === undefined}
          />
        </BigValue>
      ) : (
        <BigValue>-</BigValue>
      )}
    </Wrapper>
  )
}

export default observer(PpoBalance)
