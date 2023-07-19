import { Flex, Tooltip } from 'prepo-ui'
import styled from 'styled-components'
import Skeleton from './Skeleton'

type Props = {
  className?: string
  label: string
  tooltip?: React.ReactNode
  loading?: boolean
}

const LabelText = styled.p`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  line-height: 1.2;
  white-space: nowrap;
`

const ValueCol = styled(Flex)`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  line-height: 1.2;
  text-align: right;
`

const Wrapper = styled(Flex)`
  color: ${({ theme }) => theme.color.neutral14};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`
const SummaryRecord: React.FC<Props> = ({ children, className, label, loading, tooltip }) => {
  const record = (
    <Wrapper
      className={className}
      alignItems="flex-start"
      justifyContent="space-between"
      width="100%"
    >
      <Flex gap={4}>
        <LabelText>{label}</LabelText>
      </Flex>
      <ValueCol className="summary-record-value">
        {loading ? <Skeleton height="22px" width="64px" /> : children}
      </ValueCol>
    </Wrapper>
  )

  return tooltip === undefined ? record : <Tooltip overlay={tooltip}>{record}</Tooltip>
}

export default SummaryRecord
