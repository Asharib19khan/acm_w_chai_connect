import { Skeleton } from '@chai/ui';

export default function Loading() {
  return (
    <div
      className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-14 sm:px-8"
      role="status"
      aria-busy
      aria-label="Loading"
    >
      <Skeleton className="h-16 w-3/4" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="mt-8 h-14 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  );
}
