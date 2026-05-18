import { fetchPublicNewsletterPost } from '@/hooks/queries/newsletters'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArchivePost } from './ArchivePost'

// Public web-archive page for a newsletter post. Lives outside the
// dashboard at /[organization]/newsletter/[postSlug] — anyone with the
// URL can read it. The backend route is anonymous, and the page is
// `cache: 'no-store'` so a post freshly toggled email-only / unpublished
// stops serving immediately.

export async function generateMetadata(props: {
  params: Promise<{ organization: string; postSlug: string }>
}): Promise<Metadata> {
  const params = await props.params
  const post = await fetchPublicNewsletterPost(
    params.organization,
    params.postSlug,
  )
  if (!post) {
    return { title: 'Not found' }
  }
  const title = post.seo_meta_title || post.title || post.newsletter_name
  const description = post.seo_meta_description || post.subtitle || undefined
  const ogImage = post.web_thumbnail_url || post.cover_url || undefined
  return {
    title: `${title} · ${post.newsletter_name}`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: post.newsletter_name,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; postSlug: string }>
}) {
  const params = await props.params
  const post = await fetchPublicNewsletterPost(
    params.organization,
    params.postSlug,
  )
  if (!post) notFound()
  return <ArchivePost post={post} />
}
