'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ShadowBoxOnMd from '@spaire/ui/components/atoms/ShadowBoxOnMd'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function FormationLandingPage() {
  const params = useParams<{ organization: string }>()
  const orgSlug = params?.organization

  return (
    <DashboardBody title="Incorporate your startup">
      <ShadowBoxOnMd className="items-center justify-center gap-y-6 md:flex md:flex-col md:py-24">
        <div className="flex max-w-md flex-col items-center gap-y-6 text-center">
          <LayersOutlined
            className="dark:text-spaire-600 text-5xl text-gray-300"
            fontSize="large"
          />
          <div className="flex flex-col items-center gap-y-2">
            <h3 className="text-xl font-medium">
              Incorporate your startup
            </h3>
            <p className="dark:text-spaire-500 text-gray-500">
              Spaire partners with doola to help you form a US company in
              minutes — no matter where you are in the world. Get the legal
              foundation your startup needs to open a bank account, raise
              funding, and start selling.
            </p>
          </div>
          <Link href={`/dashboard/${orgSlug}/founder-tools/new`}>
            <Button role="link">
              <ArrowForwardOutlined className="h-4 w-4" />
              <span>Get Started</span>
            </Button>
          </Link>
        </div>
      </ShadowBoxOnMd>
    </DashboardBody>
  )
}
