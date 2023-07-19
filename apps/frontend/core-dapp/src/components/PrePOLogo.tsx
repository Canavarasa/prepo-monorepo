import { Icon } from 'prepo-ui'
import useResponsive from 'prepo-ui/src/hooks/useResponsive'

import styled from 'styled-components'
import Link from './Link'

const BrandNameWrapper = styled.div<{ $onlyLogo: boolean }>`
  span {
    height: 100%;
    svg {
      height: 100%;
    }
  }
`

const StyledLink = styled(Link)`
  align-self: stretch;
  display: flex;
`

type Props = {
  href?: string
  target?: '_blank' | '_self'
  onlyLogo?: boolean
}

const desktop = {
  name: 'brand-logo',
  width: '115',
  height: '38',
} as const

const mobile = {
  name: 'brand-logomark',
  width: '38',
  height: '38',
} as const

const PrePOLogo: React.FC<Props> = ({ href, target = '_self', onlyLogo = false }) => {
  const { isDesktop } = useResponsive()
  const config = isDesktop ? desktop : mobile
  const component = (
    <BrandNameWrapper $onlyLogo={onlyLogo}>
      <Icon color="primaryWhite" name={config.name} height={config.height} width={config.width} />
    </BrandNameWrapper>
  )

  return href ? (
    <StyledLink href={href} target={target}>
      {component}
    </StyledLink>
  ) : (
    component
  )
}

export default PrePOLogo
