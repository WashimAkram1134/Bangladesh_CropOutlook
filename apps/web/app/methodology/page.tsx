import type { Metadata } from 'next';
import { MethodologyContent } from '@/components/methodology/MethodologyContent';

export const metadata: Metadata = {
  title: 'Data & Methodology | Bangladesh Crop Outlook',
  description:
    'About This Forecast: Plain-language explanations, prediction error definitions, ' +
    'variable freshness, and verified EXP_36 Random Forest + SARIMA research methodology.',
};

export default function MethodologyPage() {
  return (
    <main className="w-full min-h-screen py-6 px-4 sm:px-6">
      <MethodologyContent />
    </main>
  );
}
