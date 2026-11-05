export default function Loading() {
  return (
    <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-10 md:px-8 lg:grid-cols-12" aria-busy="true" aria-label="Cargando producto">
      <div className="lg:col-span-7">
        <div className="skeleton aspect-square w-full" />
        <div className="mt-3 grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton aspect-square" />)}
        </div>
      </div>
      <div className="space-y-4 lg:col-span-5">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-12 w-3/4" />
        <div className="skeleton h-8 w-1/3" />
        <div className="grid grid-cols-5 gap-2 pt-6">
          {Array.from({ length: 10 }, (_, i) => <div key={i} className="skeleton h-12" />)}
        </div>
        <div className="skeleton mt-6 h-12 w-full" />
        <div className="skeleton h-12 w-full" />
      </div>
    </div>
  );
}
