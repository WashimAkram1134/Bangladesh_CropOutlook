'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}
    >
      <div
        className="mb-4 flex items-center justify-center w-14 h-14 rounded-full"
        style={{ background: 'var(--color-neutral-100)' }}
      >
        {icon ?? <Info size={22} style={{ color: 'var(--color-neutral-400)' }} />}
      </div>
      <p className="font-semibold text-sm mb-1" style={{ color: 'var(--color-neutral-700)' }}>
        {title}
      </p>
      {description && (
        <p className="text-xs max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  className?: string;
}

export function ErrorState({ title = 'Something went wrong', message, className }: ErrorStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center py-10 px-6', className)}
    >
      <div
        className="mb-4 flex items-center justify-center w-14 h-14 rounded-full"
        style={{ background: '#fef2f2' }}
      >
        <AlertTriangle size={22} style={{ color: 'var(--color-error)' }} />
      </div>
      <p className="font-semibold text-sm mb-1" style={{ color: 'var(--color-neutral-800)' }}>
        {title}
      </p>
      <p className="text-xs max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
        {message}
      </p>
    </div>
  );
}
