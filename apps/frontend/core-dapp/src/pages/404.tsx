import { Flex, Typography } from 'prepo-ui'
import Link from '../components/Link'
import { Routes } from '../lib/routes'
import SEO from '../components/SEO'

const NotFoundPage: React.FC = () => (
  <>
    <SEO
      title="Not found | prePO"
      description="Trade pre-IPO stocks & pre-IDO tokens on prePO"
      ogImageUrl="/prepo-og-image.png"
    />
    <Flex
      flexDirection="column"
      gap="1rem"
      marginBottom={{ desktop: '25rem' }}
      width="100%"
      flex={1}
    >
      <Typography as="h1" variant="text-bold-2xl" color="primary">
        404
      </Typography>
      <Typography as="p" variant="text-regular-md" color="neutral1">
        This page could not be found.
      </Typography>
      <Link href={Routes.Home}>Go back</Link>
    </Flex>
  </>
)

export default NotFoundPage
