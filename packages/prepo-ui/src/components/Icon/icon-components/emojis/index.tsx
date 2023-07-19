import { icon } from '../../utils'

export const emojisIcons = {
  emojiHalo: icon('EmojiHalo', () => import('./EmojiHalo')),
  emojiHappy: icon('EmojiHappy', () => import('./EmojiHappy')),
  emojiHeartEyes: icon('EmojiHeartEyes', () => import('./EmojiHeartEyes')),
  emojiHeartWithRibbon: icon('EmojiHeartWithRibbon', () => import('./EmojiHeartWithRibbon')),
  emojiSad: icon('EmojiSad', () => import('./EmojiSad')),
  emojiSmile: icon('EmojiSmile', () => import('./EmojiSmile')),
}
