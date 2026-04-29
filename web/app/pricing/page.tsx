import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing-nav';
import { MarketingFooter } from '@/components/marketing-footer';
import { PricingTabs } from '@/components/pricing-tabs';

export const metadata: Metadata = {
  title: 'Pricing — TechRP',
  description: 'Simple, transparent pricing for AI sales training. Individual plans from $34.99/mo. Start free — no credit card required.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <MarketingNav />
      <PricingTabs />
      <MarketingFooter current="pricing" />
    </div>
  );
}
