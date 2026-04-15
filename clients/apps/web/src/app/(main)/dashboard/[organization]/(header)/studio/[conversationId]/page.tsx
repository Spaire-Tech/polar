import { StudioPage } from '@/components/Studio/StudioPage'
import { StudioConversationWithMessages } from '@/hooks/queries/studio'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Studio',
  }
}

/**
 * Server-fetch a Studio conversation with its messages. We go straight to the
 * API via `fetch` because the generated `@spaire/client` doesn't yet expose
 * `/v1/studio/conversations/*`; once the client is regenerated this can
 * switch to `api.GET('/v1/studio/conversations/{id}')`.
 */
async function fetchConversation(
  id: string,
): Promise<StudioConversationWithMessages | null> {
  const apiUrl =
    process.env.POLAR_API_URL ?? (process.env.NEXT_PUBLIC_API_URL as string)

  const cookieStore = await cookies()
  const headerStore = await headers()

  const requestHeaders: Record<string, string> = {
    Cookie: cookieStore.toString(),
  }
  const xForwardedFor = headerStore.get('X-Forwarded-For')
  if (xForwardedFor) {
    requestHeaders['X-Forwarded-For'] = xForwardedFor
  }

  const resp = await fetch(
    `${apiUrl}/v1/studio/conversations/${encodeURIComponent(id)}`,
    {
      headers: requestHeaders,
      cache: 'no-store',
    },
  )
  if (resp.status === 404) return null
  if (!resp.ok) return null
  return (await resp.json()) as StudioConversationWithMessages
}

export default async function Page(props: {
  params: Promise<{ organization: string; conversationId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const conversation = await fetchConversation(params.conversationId)
  if (!conversation) {
    notFound()
  }

  return (
    <StudioPage
      organization={organization}
      initialConversationId={conversation.id}
      initialMessages={conversation.messages}
      initialTitle={conversation.title}
      initialProductId={conversation.product_id}
    />
  )
}
