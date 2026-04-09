import Link from 'next/link'

export default function FooterCTA() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <div className="mx-auto max-w-[600px] text-center">
          <h2 className="text-[34px] leading-[1.15] font-semibold tracking-tight text-[#0a2540] sm:text-[44px]">
            Ready to get started?
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-[#425466]">
            Explore Spaire now, or create an account and start accepting
            payments in minutes. You can always contact us to design a custom
            package for your business.
          </p>
          <div className="mt-8 flex items-center justify-center gap-5">
            <Link
              href="/signup"
              className="inline-flex items-center rounded-full bg-[#635bff] px-6 py-3 text-[15px] font-semibold text-white shadow-lg transition-all hover:bg-[#5851ea] hover:shadow-xl"
            >
              Start now{' '}
              <svg
                className="ml-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center text-[15px] font-semibold text-[#0a2540] transition-colors hover:text-[#425466]"
            >
              Contact sales{' '}
              <svg
                className="ml-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
