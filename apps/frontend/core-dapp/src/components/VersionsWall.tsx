import styled from 'styled-components'
import isOutdated from '../utils/isOutdated'

const Wrapper = styled.div`
  color: ${({ theme }): string => theme.color.neutral4};
  text-align: center;
`

const VersionsWall: React.FC = ({ children }) => {
  if (!isOutdated) return <>{children}</>

  return (
    <Wrapper>
      This version is outdated.
      <br />
      Please use the latest version
    </Wrapper>
  )
}

export default VersionsWall
