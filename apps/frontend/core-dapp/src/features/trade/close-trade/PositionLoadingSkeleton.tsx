import { Flex } from 'prepo-ui'
import Skeleton from '../../../components/Skeleton'

const PositionLoadingSkeleton: React.FC<{ noPadding?: boolean }> = ({ noPadding }) => (
  <Flex justifyContent="start" gap={16} paddingX={noPadding ? 0 : 10} paddingY={noPadding ? 0 : 8}>
    <Skeleton circle height={48} width={48} />
    <Flex flexDirection="column" alignItems="start" gap={4}>
      <Skeleton height={20} width={90} />
      <Skeleton height={14} width={52} />
    </Flex>
  </Flex>
)

export const PositionLoadingSkeletons: React.FC<{ count?: number }> = ({ count = 3 }) => (
  // repeat loading skeleton {count} times
  <>
    {new Array(count)
      .fill('')
      .map((_, index) => index)
      .map((key) => (
        <PositionLoadingSkeleton key={key} />
      ))}
  </>
)

export default PositionLoadingSkeleton
