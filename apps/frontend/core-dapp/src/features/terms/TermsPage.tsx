import styled from 'styled-components'
import { Button, spacingIncrement } from 'prepo-ui'
import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useRootStore } from '../../context/RootStoreProvider'
import Link from '../../components/Link'
import { PREPO_TERMS_LINK } from '../../lib/constants'
import { TestIds } from '../../components/TestId'

const TermsList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
  margin-bottom: 0;
  margin-top: ${spacingIncrement(12)};
  padding-left: ${spacingIncrement(26)};
  padding-right: 14px;
`

const Wrapper = styled.div`
  font-size: ${({ theme }): string => theme.fontSize.base};
  max-height: 40vh;
  overflow-y: auto;
`

const TermsPage: React.FC = () => {
  const { termsStore } = useRootStore()
  const [read, setRead] = useState(false)

  return (
    <>
      <Wrapper
        data-testid={TestIds.TermsScroll}
        onScroll={(e): void => {
          if (!(e.target instanceof HTMLDivElement)) return
          const remainingScrollPx =
            e.target.scrollHeight - e.target.scrollTop - e.target.offsetHeight

          if (remainingScrollPx < 16) {
            setRead(true)
          }
        }}
      >
        <p>
          By clicking “I Agree” below, you agree to be bound by the terms of this agreement. As
          such, you agree and fully understand that:
        </p>
        <TermsList>
          <li>
            You will only access prePO, now or in future, if it is legally permitted for you to do
            so according to all applicable laws.
          </li>
          <li>
            You are not accessing prePO from the United States, Burma (Myanmar), Cuba, Iran, Sudan,
            Syria, the Western Balkans, Belarus, Côte d’Ivoire, Democratic Republic of the Congo,
            Iraq, Lebanon, Liberia, Libya, North Korea, Russia, certain sanctioned areas of Ukraine,
            Somalia, Venezuela, Yemen, or Zimbabwe, or any other jurisdiction listed as a Specially
            Designated National by the United States Office of Foreign Asset Control (OFAC).
          </li>
          <li>
            prePO is a blockchain-based decentralized finance project operated by a decentralized
            autonomous organization (“DAO”). You are participating at your own risk. Please
            carefully review our{' '}
            <Link href={PREPO_TERMS_LINK} target="_blank">
              Terms of Service
            </Link>{' '}
            for a more detailed description of the risks involved with participating in the use of
            prePO.
          </li>
          <li>
            prePO is offered for use “as is” and without any guarantees regarding security. The
            protocol is made up of upgradeable smart contracts and may be accessed through a variety
            of user interfaces, including app.prepo.io and prepo.eth.limo.
          </li>
          <li>
            You have done your own research on prePO and the PPO token and understand and assume the
            risks associated with purchasing, using, sending, or receiving PPO tokens or tokens
            corresponding to a prePO market.
          </li>
          <li>
            The laws that apply to your use of prePO may vary based upon the jurisdiction in which
            you are located. We strongly encourage you to speak with legal counsel in your
            jurisdiction if you have any questions regarding your use of prePO.
          </li>
          <li>prePO is not registered as a broker-dealer in any jurisdiction.</li>
          <li>
            By entering into this agreement, you are not agreeing to enter into a partnership.
          </li>
          <li>
            You release all present and future claims against prePO and its affiliates by using the
            Services (as defined in the Terms of Service).
          </li>
          <li>
            You agree to indemnify and hold harmless prePO and its affiliates for any costs arising
            out of or relating to your use of the Services (as defined in the Terms of Service).
          </li>
          <li>
            The rules and parameters associated with the prePO protocol and prePO DAO governance are
            subject to change at any time.
          </li>
          <li>
            The purpose, benefits, and functionalities of the PPO token are determined by the prePO
            DAO and are subject to change.
          </li>
          <li>
            The PPO token is currently non-transferable and non-tradable. In future, token holders
            will be able to vote to unlock transfers if they determine it would comply with all
            applicable laws, that the governance is sufficiently decentralized, and that doing so
            would be in prePO&apos;s best interest.
          </li>
          <li>
            The information provided or referenced on this site is: for informational purposes only
            and should not be considered legal, financial, or investment advice; not a
            recommendation or solicitation to buy, sell, exchange, or hold securities, or to
            participate in any prePO markets or PPO-related programs; not guaranteed to be accurate,
            complete, or useful; used at your own risk; subject to change without notice. You are
            responsible for obtaining current information and performing your own due diligence
            before accessing or using the Services (as defined in the Terms of Service).
          </li>
          <li>
            If you cannot agree to all of the above terms of participation, you must exit this
            website.
          </li>
        </TermsList>
      </Wrapper>
      <Button block disabled={!read} onClick={termsStore.agreeToTerms}>
        I Agree
      </Button>
    </>
  )
}

export default observer(TermsPage)
