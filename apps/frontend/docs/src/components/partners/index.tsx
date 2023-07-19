import React from 'react'
import useBaseUrl from '@docusaurus/useBaseUrl'
import { partners } from './partners'
import style from './partner.module.css'

type PartnerProps = {
  name: string
  image: string
  website: string
}

const Partner: React.FC<{ partner: PartnerProps }> = ({ partner }) => {
  const imgUrl = useBaseUrl(`/img/partners/${partner.image}`)
  return (
    <li className={style.partnerWrapper}>
      <a
        className={style.partnerLink}
        href={partner.website}
        target="_blank"
        rel="noopener noreferrer"
      >
        <img className={style.partnerImage} loading="lazy" src={imgUrl} alt={partner.name} />
        <p className={style.partnerName}>{partner.name}</p>
      </a>
    </li>
  )
}

const Partners: React.FC = () => (
  <ul className={style.partnersWrapper}>
    {partners.map((partner) => (
      <Partner key={partner.name} partner={partner} />
    ))}
  </ul>
)

export default Partners
