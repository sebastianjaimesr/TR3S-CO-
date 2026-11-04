import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-ink px-4 text-center">
      <div>
        <div className="flex justify-center"><Logo size={120} /></div>
        <p className="monumental mt-8 text-[30vw] md:text-[14rem]" aria-hidden>404</p>
        <h1 className="font-display text-3xl font-bold">Este paso no existe.</h1>
        <Link href="/shop" className="btn btn-primary mt-8">Volver a la tienda</Link>
      </div>
    </main>
  );
}
