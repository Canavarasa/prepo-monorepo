import { ReactNode } from 'react'

const bannerContent: ReactNode | undefined = undefined

const Banner: React.FC = () => {
  if (!bannerContent) return null

  return (
    <div className="p-2 text-white bg-prepo">
      <p className="text-center leading-4">{bannerContent}</p>
    </div>
  )
}

export default Banner
