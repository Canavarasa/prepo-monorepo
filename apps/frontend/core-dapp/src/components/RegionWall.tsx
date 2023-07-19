import styled from 'styled-components'
import { isUserInBannedRegion } from '../utils/region'
import { usePromise } from '../hooks/usePromise'

const Wrapper = styled.div`
  color: ${({ theme }): string => theme.color.neutral4};
  text-align: center;
`

export const useRegionBlocked = (): boolean => {
  const regionBlock = usePromise(isUserInBannedRegion)
  return regionBlock.status === 'success' && regionBlock.value
}

const RegionWall: React.FC = ({ children }) => {
  const regionBlocked = useRegionBlocked()

  if (regionBlocked) {
    return (
      <Wrapper>
        prePO is not available in your jurisdiction.
        <br />
        We apologize for the inconvenience.
      </Wrapper>
    )
  }

  return <>{children}</>
}

export default RegionWall
