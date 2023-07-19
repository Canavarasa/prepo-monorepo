import React from 'react'

const Investor: React.FC<{
  investor: { name: string; website?: string; title?: string; secondName?: string }
}> = ({ investor }) => (
  <li className="investor-wrapper">
    {investor.website ? (
      <p className="investor-name">
        <a
          className="investor-link"
          href={investor.website}
          target="_blank"
          rel="noopener noreferrer"
        >
          {investor.name}
        </a>
        {investor.secondName ? <span> {investor.secondName}</span> : null}
      </p>
    ) : (
      <p className="investor-name">{investor.name}</p>
    )}
    {investor.title ? <p className="investor-title">{investor.title}</p> : null}
  </li>
)

export default Investor
