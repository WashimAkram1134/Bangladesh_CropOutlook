'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'amber' | 'gray' | 'blue' | 'red';
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({ children, variant = 'gray', className, style }: BadgeProps) {
  return (
    <span className={cn('badge', `badge-${variant}`, className)} style={style}>
      {children}
    </span>
  );
}

