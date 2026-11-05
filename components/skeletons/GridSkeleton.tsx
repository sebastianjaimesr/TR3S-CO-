/** Skeleton for catalog grids while a page streams in. */
export function GridSkeleton({ count = 8, title = true }: { count?: number; title?: boolean }) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8" aria-busy="true" aria-label="Cargando">
      {title && <div className="skeleton mb-10 h-14 w-2/3 max-w-md" />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[4/5] w-full" />
            <div className="skeleton mt-3 h-3 w-1/3" />
            <div className="skeleton mt-2 h-4 w-3/4" />
            <div className="skeleton mt-2 h-4 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
