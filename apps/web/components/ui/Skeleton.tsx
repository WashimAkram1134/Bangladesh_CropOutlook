'use client';

/** Generic skeleton loading placeholder */
export function Skeleton({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** Skeleton for a metric card */
export function MetricCardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32 mt-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
