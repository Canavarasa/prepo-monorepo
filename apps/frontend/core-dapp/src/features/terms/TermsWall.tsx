import { observer } from 'mobx-react-lite'
import { spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import Head from 'next/head'
import RulesPage from './RulesPage'
import TermsPage from './TermsPage'
import Card from '../../components/Card'
import Steps from '../../components/Steps'
import { useRootStore } from '../../context/RootStoreProvider'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
  margin: auto;
  max-width: ${spacingIncrement(480)};
  position: relative;
  width: 100%;
`
const WhiteBox = styled(Card)`
  position: relative;
  width: 100%;
  &&& {
    .ant-card-body {
      align-items: center;
      color: ${({ theme }): string => theme.color.neutral4};
      display: flex;
      flex-direction: column;
      gap: ${spacingIncrement(16)};
      justify-content: center;
      min-height: ${spacingIncrement(240)};
      padding: ${spacingIncrement(16)};
      :before,
      :after {
        display: none;
      }
    }
  }
`

const Title = styled.h1`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.xl};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  text-align: center;
`

const TermsWall: React.FC = ({ children }) => {
  const { termsStore } = useRootStore()
  const { agreedToCurrentTerms, showTermsPage } = termsStore

  if (showTermsPage) {
    const title = 'prePO Participant Agreement'

    return (
      <Wrapper>
        <Head>
          <title>{title}</title>
        </Head>

        <Title>{title}</Title>
        <WhiteBox>
          {agreedToCurrentTerms ? <RulesPage /> : <TermsPage />}
          <Steps steps={2} currentStep={agreedToCurrentTerms ? 1 : 0} />
        </WhiteBox>
      </Wrapper>
    )
  }

  return <>{children}</>
}

export default observer(TermsWall)
