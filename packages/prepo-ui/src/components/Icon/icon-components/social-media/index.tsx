import { icon } from '../../utils'

export const socialMediaIcons = {
  discord: icon('DiscordIcon', () => import('./DiscordIcon')),
  'discord-outlined': icon('DiscordOutlinedIcon', () => import('./DiscordOutlinedIcon')),
  linkedin: icon('LinkedinIcon', () => import('./LinkedinIcon')),
  medium: icon('MediumIcon', () => import('./MediumIcon')),
  telegram: icon('TelegramIcon', () => import('./TelegramIcon')),
  twitter: icon('TwitterIcon', () => import('./TwitterIcon')),
  'twitter-outlined': icon('TwitterOutlinedIcon', () => import('./TwitterOutlinedIcon')),
}
