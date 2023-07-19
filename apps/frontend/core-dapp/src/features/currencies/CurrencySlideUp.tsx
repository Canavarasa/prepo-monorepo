import { observer } from 'mobx-react-lite'
import CurrencyRow from './CurrencyRow'
import SlideUpCard, { SlideUpCardProps } from '../trade/SlideUpCard'
import { Token } from '../../stores/TokensStore'

type Props = {
  hideBalance?: boolean
  onChange?: (token: Token) => void
  selectedToken?: Token
  tokens: Token[]
  slideUpCard: SlideUpCardProps
}

const CurrencySlideUp: React.FC<Props> = ({
  hideBalance,
  onChange,
  selectedToken,
  tokens,
  slideUpCard,
}) => {
  const handleClick = (token: Token): void => {
    onChange?.(token)
  }

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <SlideUpCard {...slideUpCard}>
      {selectedToken && (
        <CurrencyRow
          token={selectedToken}
          onClick={handleClick}
          selected
          hideBalance={hideBalance}
        />
      )}
      {tokens
        .filter((token) => {
          if (selectedToken?.type === 'native') return token.type !== 'native'
          return token.type === 'native' || token.erc20.address !== selectedToken?.erc20.address
        })
        .map((token) => (
          <CurrencyRow
            key={token.type === 'native' ? 'native' : token.erc20.address}
            onClick={handleClick}
            token={token}
            hideBalance={hideBalance}
          />
        ))}
    </SlideUpCard>
  )
}

export default observer(CurrencySlideUp)
