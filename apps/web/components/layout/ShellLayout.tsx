'use client';

import { useState } from 'react';
import { LeftSidebar } from './LeftSidebar';

interface ShellLayoutProps {
  children: React.ReactNode;
}

export function ShellLayout({ children }: ShellLayoutProps) {
  const [locale, setLocale] = useState<'en' | 'bn'>('en');

  const toggleLocale = () => {
    setLocale((prev) => (prev === 'en' ? 'bn' : 'en'));
  };

  return (
    <div className="app-wallpaper">
      {/* Floating Application Shell Container (Option A Blueprint) */}
      <div className="floating-app-shell">
        {/* Left Narrow Icon Navigation */}
        <LeftSidebar onLanguageToggle={toggleLocale} locale={locale} />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#f4f6f4] overflow-y-auto custom-scrollbar p-3.5 md:p-4 lg:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
