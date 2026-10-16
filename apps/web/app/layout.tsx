import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: 'Bangladesh Crop Outlook | Agricultural Forecasting System',
  description:
    'GIS and AI-based crop yield and production forecasting system for Bangladesh. ' +
    'Covers 64 districts and six major crops using Random Forest prediction and SARIMA environmental forecasting.',
  keywords: [
    'Bangladesh agriculture',
    'crop forecast',
    'yield prediction',
    'GIS',
    'Random Forest',
    'SARIMA',
    'Aman Rice',
    'Boro Rice',
    'Aus Rice',
    'Potato',
    'Wheat',
    'Jute',
  ],
  authors: [{ name: 'Bangladesh Crop Outlook Research Team' }],
  openGraph: {
    title: 'Bangladesh Crop Outlook',
    description: 'Agricultural intelligence and seasonal crop forecasting for Bangladesh.',
    type: 'website',
  },
};

import { ShellLayout } from '@/components/layout/ShellLayout';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen m-0 p-0 overflow-x-hidden" suppressHydrationWarning>
        <ShellLayout>{children}</ShellLayout>
      </body>
    </html>
  );
}
