import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { Flex, Icon, media, spacingIncrement } from 'prepo-ui'
import { displayEth } from '../../utils/number-utils'
import Skeleton from '../../components/Skeleton'
import { Token } from '../../stores/TokensStore'
import { useRootStore } from '../../context/RootStoreProvider'

type Props = {
  hideBalance?: boolean
  onClick: (token: Token) => void
  token: Token
  selected?: boolean
}

const Wrapper = styled.div<{ $selected?: boolean }>`
  align-items: center;
  border: ${({ $selected, theme }): string =>
    `solid 2px ${theme.color[$selected ? 'success' : 'transparent']}`};
  border-radius: ${({ theme }): string => theme.borderRadius.base};
  cursor: pointer;
  display: flex;
  gap: ${spacingIncrement(8)};
  justify-content: space-between;
  padding: ${spacingIncrement(6)} ${spacingIncrement(8)};
  width: 100%;
  :hover {
    background-color: ${({ theme }): string => theme.color.accentPrimary};
  }
  ${media.phone`
    gap: ${spacingIncrement(16)};
  `}
`

const NameWrapper = styled.div`
  align-items: center;
  display: flex;
  width: 100%;
`

const Name = styled.p`
  color: ${({ theme }): string => theme.color.secondary};
  display: inline-block;
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: max-content;
`

const Balance = styled.p`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: 1.2;
`

const CurrencyRow: React.FC<Props> = ({ hideBalance, onClick, token, selected }) => {
  const { tokensStore } = useRootStore()
  let balanceUI: React.ReactNode = <Skeleton width={60} height={16} />
  const balance = tokensStore.getTokenBalance(token)

  if (balance !== undefined) balanceUI = <Balance>{displayEth(+balance)}</Balance>

  if (hideBalance) balanceUI = null

  return (
    <Wrapper onClick={(): void => onClick(token)} $selected={selected}>
      <Flex position="relative">
        {/* TODO: design token icon placeholder for unknown tokens */}
        {token.iconName && (
          <Flex borderRadius="48px" overflow="hidden">
            <Icon name={token.iconName} height="48" width="48" />
          </Flex>
        )}
        {selected && (
          <Flex
            color="white"
            bg="success"
            position="absolute"
            bottom={0}
            right={0}
            width={16}
            height={16}
            borderRadius={16}
          >
            <Icon name="check" width="12" height="12" />
          </Flex>
        )}
      </Flex>
      <Flex
        flexDirection="column"
        alignItems="start"
        justifyContent="center"
        flex={1}
        minWidth="0px"
      >
        <NameWrapper>
          <Name>{token.name}</Name>
        </NameWrapper>
        {balanceUI}
      </Flex>
    </Wrapper>
  )
}

export default observer(CurrencyRow)
