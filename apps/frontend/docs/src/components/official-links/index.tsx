import React from 'react'
import style from './OfficialLinks.module.css'
import { socialMedia, token, events, web3, keyLinks, other } from './links'

type ListProps = {
  icon: string
  title: string
  items: { name: string; link: string }[]
}

const List: React.FC<{ list: ListProps }> = ({ list }) => (
  <div>
    <h3>
      <span>{list.icon}</span> {list.title}
    </h3>
    <ul className={style.itemsWrapper}>
      {list.items.map(({ link, name }) => (
        <li key={name}>
          <a href={link} target="_blank" rel="noopener noreferrer">
            {name}
          </a>
        </li>
      ))}
    </ul>
  </div>
)

const OfficialLinks: React.FC = () => (
  <div>
    <div className={style.listsWrapper}>
      <List list={keyLinks} />
      <List list={token} />
      <List list={web3} />
    </div>
    <div className={style.listsWrapper}>
      <List list={events} />
      <List list={socialMedia} />
      <List list={other} />
    </div>
  </div>
)

export default OfficialLinks
