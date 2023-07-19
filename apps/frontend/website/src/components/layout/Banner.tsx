import { ReactNode } from 'react'
import { PREPO_STARKNET_MARKET_BLOG_POST } from '../../lib/constants'
import { Button } from '../Button'

const bannerContent: ReactNode | undefined = (
  <>
    Starknet pre-token market is live!
    {PREPO_STARKNET_MARKET_BLOG_POST !== undefined && (
      <>
        {' '}
        <Button
          className="underline cursor-pointer !p-0 font-normal text-base hover:!bg-transparent leading-4"
          iconClassName="!ml-1"
          href={PREPO_STARKNET_MARKET_BLOG_POST}
          target="_blank"
          iconSize={16}
          withShareIcon={false}
        >
          Learn more ↗
        </Button>
      </>
    )}
  </>
)

const Banner: React.FC = () => {
  if (!bannerContent) return null

  return (
    <div className="p-2 text-white bg-prepo">
      <p className="text-center leading-4">{bannerContent}</p>
    </div>
  )
}

export default Banner
