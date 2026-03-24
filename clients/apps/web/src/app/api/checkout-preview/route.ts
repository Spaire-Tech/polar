import { getServerSideAPI } from '@/utils/client/serverside'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { product_id } = await request.json()

  if (!product_id) {
    return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
  }

  const api = await getServerSideAPI()

  const { data, error } = await api.POST('/v1/checkouts/client/', {
    body: { product_id },
  })

  if (error) {
    return NextResponse.json(
      { error: typeof error.detail === 'string' ? error.detail : 'Failed to create checkout' },
      { status: 422 },
    )
  }

  return NextResponse.json({ client_secret: data.client_secret })
}
