import NextLink from 'next/link'
import styled, { css } from 'styled-components'

const Anchor = styled.a<{ $underline: boolean; $nowrap: boolean }>`
  color: ${({ theme }): string => theme.color.primaryLight};
  ${({ $underline }) =>
    $underline
      ? css`
          text-decoration: underline;
          :hover {
            text-decoration: underline;
          }
        `
      : ''}
  ${({ $nowrap }) =>
    $nowrap
      ? css`
          white-space: nowrap;
        `
      : ''}
`

type Props = {
  href: string
  target?: '_self' | '_blank'
  className?: string
  scroll?: boolean
  underline?: boolean
  nowrap?: boolean
}

const Link: React.FC<Props> = ({
  className,
  href,
  target = '_self',
  children,
  underline = true,
  scroll,
  nowrap = true,
}) => (
  <NextLink href={href} passHref scroll={scroll}>
    <Anchor
      className={className}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : ''}
      $underline={underline}
      $nowrap={nowrap}
    >
      {children}
    </Anchor>
  </NextLink>
)

export default Link
