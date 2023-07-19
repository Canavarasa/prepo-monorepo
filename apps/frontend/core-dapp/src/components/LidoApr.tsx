import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import Skeleton from './Skeleton'
import { useRootStore } from '../context/RootStoreProvider'

const Wrapper = styled.span`
  color: ${({ theme }): string => theme.color.success};
  display: flex;
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const LidoApr: React.FC<{ className?: string }> = ({ className }) => {
  const {
    lidoStore: { apr },
  } = useRootStore()

  return (
    <Wrapper className={className}>
      {apr === undefined ? <Skeleton width="40px" height="100%" /> : apr}
      <span>&nbsp;APR</span>
    </Wrapper>
  )
}

export default observer(LidoApr)
