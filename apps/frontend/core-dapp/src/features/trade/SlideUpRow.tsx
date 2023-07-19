import { observer } from 'mobx-react-lite'
import { Flex, Icon, media, spacingIncrement } from 'prepo-ui'
import styled, { Color } from 'styled-components'
import Skeleton from '../../components/Skeleton'
import { displayEth } from '../../utils/number-utils'
import { PositionEntity } from '../../stores/entities/Position.entity'

type Props = {
  afterName?: React.ReactNode
  className?: string
  onClick?: () => void
  selected?: boolean
  position: PositionEntity
  showBalance?: boolean
}

const Wrapper = styled.div<{ $clickable: boolean; $selected?: boolean }>`
  align-items: center;
  border: ${({ $selected, theme }): string =>
    `solid 2px ${theme.color[$selected ? 'success' : 'transparent']}`};
  border-radius: ${({ theme }): string => theme.borderRadius.base};
  cursor: ${({ $clickable }): string => ($clickable ? 'pointer' : 'initial')};
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
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: 1.2;
  text-align: right;
`

const DirectionLabel = styled.p<{ color: keyof Color }>`
  color: ${({ color, theme }): string => theme.color[color ?? 'success']};
  line-height: 1.2;
  text-align: right;
  text-transform: capitalize;
`

const SlideUpRow: React.FC<Props> = ({
  afterName,
  className,
  selected,
  onClick,
  position,
  showBalance = false,
}) => (
  <Wrapper className={className} onClick={onClick} $clickable={!!onClick} $selected={selected}>
    <Flex position="relative">
      <Icon name={position.market.iconName} height="48" width="48" />
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
    {/** min-width: 0px is applied to make text overflow ellipsis work */}
    <Flex flexDirection="column" alignItems="start" justifyContent="center" flex={1} minWidth="0px">
      <NameWrapper>
        <Name>{position.market.name}</Name>
        {afterName}
      </NameWrapper>
    </Flex>
    {showBalance && (
      <Flex alignItems="end" flexDirection="column" paddingRight={4}>
        {position.totalValueInEth !== undefined ? (
          <Balance>{displayEth(+position.totalValueInEth)}</Balance>
        ) : (
          <Skeleton width={60} height={20} />
        )}
        <DirectionLabel color={position.direction === 'long' ? 'success' : 'error'}>
          {position.direction}
        </DirectionLabel>
      </Flex>
    )}
  </Wrapper>
)

export default observer(SlideUpRow)
