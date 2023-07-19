import { PREPO_TERMS_LINK, PREPO_PRIVACY_POLICY_LINK } from './constants'
import Link from '../components/Link'

const rules = [
  {
    id: 1,
    content: (
      <p>
        I have read, understood and agree to the{' '}
        <Link href={PREPO_TERMS_LINK} target="_blank">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href={PREPO_PRIVACY_POLICY_LINK} target="_blank">
          Privacy Policy
        </Link>
      </p>
    ),
  },
  {
    id: 2,
    content:
      'I understand that prePO assets are synthetic in nature, fully-collateralized by Lido Wrapped Staked ETH, and are not backed by real-world equity or tokens.',
  },
  {
    id: 3,
    content:
      'I understand and acknowledge that any protocol parameter values, including those relating to fees and token rewards, are subject to change at any time.',
  },
  {
    id: 4,
    content:
      'I acknowledge that prePO is experimental software that may result in the complete loss of funds, and that prePO will not cover any loss of funds in the case of any security incident.',
  },
]

export default rules
