import { Navbar } from '@/components/landing/navbar';
import { HeroSection } from '@/components/landing/hero-section';
import { FeatureGrid } from '@/components/landing/feature-grid';
import { AboutSection } from '@/components/landing/about-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { GlitchMarquee } from '@/components/landing/glitch-marquee';
import { Footer } from '@/components/landing/footer';

export default function Page() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <HeroSection />
        <FeatureGrid />
        <AboutSection />
        <PricingSection />
        <GlitchMarquee />
      </main>
      <Footer />
    </div>
  );
}
