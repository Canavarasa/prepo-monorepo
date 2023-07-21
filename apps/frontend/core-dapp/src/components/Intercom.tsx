import Script from 'next/script'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { deferred } from '../utils/deferred'

const Intercom: React.FC<{ apiBase: string; appId: string }> = ({ appId, apiBase }) => {
  const intercomDeferred = useRef(deferred<typeof window.Intercom>())
  const { events } = useRouter()

  useEffect(() => {
    const onRouteChangeComplete = async (): Promise<void> => {
      const intercom = await intercomDeferred.current.asPromise
      intercom('update')
    }

    events.on('routeChangeComplete', onRouteChangeComplete)
    return () => {
      events.off('routeChangeComplete', onRouteChangeComplete)
    }
  }, [intercomDeferred, events])

  return (
    <Script
      src={`https://widget.intercom.io/widget/${appId}`}
      type="text/javascript"
      onLoad={() => {
        window.Intercom('boot', {
          api_base: apiBase,
          app_id: appId,
        })
        intercomDeferred.current.setValue(window.Intercom)
      }}
    />
  )
}

const IntercomWrapper: React.FC = () => {
  if (!process.env.NEXT_PUBLIC_INTERCOM_APP_ID || !process.env.NEXT_PUBLIC_INTERCOM_API_BASE)
    return null

  return (
    <Intercom
      apiBase={process.env.NEXT_PUBLIC_INTERCOM_API_BASE}
      appId={process.env.NEXT_PUBLIC_INTERCOM_APP_ID}
    />
  )
}

export default IntercomWrapper
