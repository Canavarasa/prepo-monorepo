import { Flex, Icon, spacingIncrement } from 'prepo-ui'
import { ToastContainer, toast as _toast, ToastOptions as ToastifyOptions } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import styled, { createGlobalStyle } from 'styled-components'
import NextLink from 'next/link'

type ToastOptions = {
  description?: React.ReactNode
  link?: string
} & ToastifyOptions

export const ToastStyle = createGlobalStyle`
  .Toastify__toast-container > div {
    background-color: ${({ theme }): string => theme.color.neutral9};
    border-radius: ${({ theme }): string => theme.borderRadius.sm};
    box-shadow: ${({ theme }): string => theme.shadow.prepo};
    font-family: ${({ theme }): string => theme.fontFamily.primary};
    line-height: 1.2;
  }
  .Toastify__progress-bar--error {
    background: ${({ theme }): string => theme.color.error};
  }
  .Toastify__progress-bar--success {
    background: ${({ theme }): string => theme.color.success};
  }
  .Toastify__close-button {
    color: ${({ theme }): string => theme.color.neutral5};
    opacity: 1;
    :hover {
      opacity: 0.6;
    }
  }
`

const Title = styled.p`
  color: ${({ theme }): string => theme.color.secondary};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const Anchor = styled.a`
  color: ${({ theme }): string => theme.color.secondary};
  white-space: nowrap;
  > div > div {
    color: ${({ theme }): string => theme.color.neutral5};
  }
  :hover {
    color: ${({ theme }): string => theme.color.secondary};
    opacity: 0.8;
    > div > div {
      color: ${({ theme }): string => theme.color.neutral5};
    }
  }
`

const TitleLink = styled(NextLink)`
  color: ${({ theme }): string => theme.color.secondary};
  display: flex;
  text-decoration: none;
  width: max-content;
`

const DescriptionWrapper = styled.div`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.sm};
`

const toastFunction = (title: string, _options: ToastOptions = {}): void => {
  const { description, link, ...options } = _options

  const titleComponent =
    link === undefined ? (
      <Title>{title}</Title>
    ) : (
      <TitleLink passHref href={link} target="_blank">
        <Anchor target="_blank" rel="noopener noreferrer">
          <Flex gap={8} justifyContent="flex-start" width="max-content">
            <Title>{title}</Title>
            <div>
              <Icon
                name="arrow-up-right"
                height={spacingIncrement(16)}
                width={spacingIncrement(16)}
              />
            </div>
          </Flex>
        </Anchor>
      </TitleLink>
    )

  _toast(
    <Flex flexDirection="column" justifyContent="flex-start" alignItems="flex-start" gap={8}>
      {titleComponent}
      {description !== undefined && <DescriptionWrapper>{description}</DescriptionWrapper>}
    </Flex>,
    options
  )
}

export const toast = {
  error: (title: string, options: ToastOptions = {}): void =>
    toastFunction(title, { ...options, type: 'error' }),
  success: (title: string, options: ToastOptions = {}): void =>
    toastFunction(title, { ...options, type: 'success' }),
  warning: (title: string, options: ToastOptions = {}): void =>
    toastFunction(title, { ...options, type: 'warning' }),
}

export const ToastifyContainer: React.FC<{ testId?: string }> = ({ testId }) => (
  <div data-testid={testId} style={{ display: 'contents' }}>
    <ToastContainer
      position="top-right"
      autoClose={3000}
      icon={false}
      pauseOnHover
      closeOnClick={false}
    />
  </div>
)
