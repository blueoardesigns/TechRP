export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-4 w-32" />
        <SkeletonLine className="h-5 w-16 rounded-full" />
      </div>
      <SkeletonLine className="h-3 w-24" />
      <div className="flex gap-2 pt-1">
        <SkeletonLine className="h-3 w-20" />
        <SkeletonLine className="h-3 w-16" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-white/5">
      <SkeletonLine className="h-4 w-28" />
      <SkeletonLine className="h-4 w-20 ml-auto" />
      <SkeletonLine className="h-5 w-14 rounded-full" />
      <SkeletonLine className="h-4 w-12" />
    </div>
  );
}

export function SkeletonPlaybookCard() {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <SkeletonLine className="h-4 w-40" />
        <SkeletonLine className="h-5 w-20 rounded-full" />
      </div>
      <SkeletonLine className="h-3 w-full" />
      <SkeletonLine className="h-3 w-3/4" />
    </div>
  );
}
