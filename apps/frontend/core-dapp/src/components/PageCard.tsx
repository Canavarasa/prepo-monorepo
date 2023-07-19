import { Icon, Tooltip, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import ACard from './Card'
import Link from './Link'

type Props = {
  backUrl?: string
  title: string
  titleTooltip?: React.ReactNode
  onClickSettings?: () => void
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
  margin: 0 auto;
  max-width: ${spacingIncrement(380)};
  position: relative;
  width: 100%;
`

const Card = styled(ACard)`
  position: relative;
  width: 100%;
  &&& {
    .ant-card-body {
      min-height: ${spacingIncrement(240)};
      padding: 0;
    }
  }
`

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
  padding: ${spacingIncrement(8)};
  padding-bottom: ${spacingIncrement(16)};
`

// header elements

const Header = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: ${spacingIncrement(24)};
  padding-bottom: ${spacingIncrement(8)};
  position: relative;
`

const IconWrapper = styled.div`
  color: ${({ theme }): string => theme.color.neutral2};
  min-height: ${spacingIncrement(16)};
  min-width: ${spacingIncrement(16)};
`

const Title = styled.h2`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.lg};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const TitleWrapper = styled.div`
  position: relative;
`

const TitleTooltipWrapper = styled.div`
  position: absolute;
  right: -4px;
  top: 50%;
  transform: translate(100%, -50%);
`
const BackLink = styled(Link)`
  color: ${({ theme }): string => theme.color.neutral2};
  :hover {
    opacity: 0.7;
  }
`

const SettingsButton = styled.button`
  background-color: transparent;
  border: none;
  color: ${({ theme }): string => theme.color.neutral3};
  cursor: pointer;
  padding: 0;
  :hover {
    opacity: 0.7;
  }
`

const PageCard: React.FC<Props> = ({ backUrl, children, onClickSettings, title, titleTooltip }) => (
  <Wrapper>
    <Card>
      <Header>
        <IconWrapper>
          {backUrl && (
            <BackLink href={backUrl}>
              <Icon name="chevron-left" height="16" width="16" />
            </BackLink>
          )}
        </IconWrapper>
        <TitleWrapper>
          <Title>{title}</Title>
          {titleTooltip && (
            <TitleTooltipWrapper>
              <Tooltip overlay={titleTooltip}>
                <Icon name="info-outlined" color="neutral5" height="14" width="14" />
              </Tooltip>
            </TitleTooltipWrapper>
          )}
        </TitleWrapper>
        <IconWrapper>
          {onClickSettings && (
            <SettingsButton>
              <Icon name="settings" height="16" width="16" />
            </SettingsButton>
          )}
        </IconWrapper>
      </Header>
      <Body>{children}</Body>
    </Card>
  </Wrapper>
)

export default PageCard
