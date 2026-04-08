import MarketingNav from './MarketingNav'
import HeroSection from './HeroSection'
import {
  ModularSolutionsIntro,
  PaymentsSection,
  BillingSection,
  MerchantOfRecordSection,
  SpairSpaceSection,
} from './ProductSections'
import GlobalScaleSection from './GlobalScaleSection'
import DeveloperSection from './DeveloperSection'
import GrowthSection from './GrowthSection'
import LaunchSection from './LaunchSection'
import FooterCTA from './FooterCTA'
import MarketingFooter from './MarketingFooter'

export default function Homepage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* Hero */}
      <HeroSection />

      {/* Product sections */}
      <section className="bg-white" id="products">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
          <ModularSolutionsIntro />
          <PaymentsSection />
          <div className="border-b border-[#e6ebf1]" />
          <BillingSection />
          <div className="border-b border-[#e6ebf1]" />
          <MerchantOfRecordSection />
          <div className="border-b border-[#e6ebf1]" />
          <SpairSpaceSection />
        </div>
      </section>

      {/* Global Scale (dark) */}
      <GlobalScaleSection />

      {/* Developers (dark) */}
      <div id="developers">
        <DeveloperSection />
      </div>

      {/* Built for Growth */}
      <div id="solutions">
        <GrowthSection />
      </div>

      {/* Launch with ease */}
      <LaunchSection />

      {/* Footer CTA */}
      <FooterCTA />

      {/* Footer */}
      <MarketingFooter />
    </div>
  )
}
