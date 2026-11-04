"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { BagIcon, ChevronIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from "@/components/icons";
import { mainNav } from "@/lib/site";
import { cn } from "@/lib/format";
import { useCart } from "@/features/cart/store";
import { useWishlist } from "@/features/wishlist/store";
import { useHydrated } from "@/hooks/useHydrated";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const count = useCart((s) => s.items.reduce((a, i) => a + i.quantity, 0));
  const setCartOpen = useCart((s) => s.setOpen);
  const wishCount = useWishlist((s) => s.items.length);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const submitSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-line transition-colors duration-300",
        scrolled ? "bg-ink/90 backdrop-blur-md" : "bg-ink",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 md:h-[72px] md:px-8">
        <button
          type="button"
          className="-ml-2 grid h-11 w-11 place-items-center text-paper lg:hidden"
          aria-label="Abrir menú"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <MenuIcon />
        </button>

        <Logo size={48} priority className="md:h-[52px] md:w-[52px]" />

        <nav aria-label="Principal" className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-1 xl:gap-2">
            {mainNav.map((item) => {
              const active = pathname === item.href;
              return (
                <li
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => item.children && setOpenMenu(item.label)}
                  onMouseLeave={() => setOpenMenu(null)}
                >
                  <div className="flex items-center">
                    <Link
                      href={item.href}
                      className={cn(
                        "px-3 py-6 font-display text-[12px] font-medium tracking-[0.18em] transition-colors hover:text-crimson",
                        active ? "text-crimson" : item.label === "SALE" ? "text-paper" : "text-paper",
                      )}
                    >
                      {item.label}
                    </Link>
                    {item.children && (
                      <button
                        type="button"
                        className="-ml-2 p-1 text-smoke hover:text-paper"
                        aria-label={`Submenú ${item.label}`}
                        aria-expanded={openMenu === item.label}
                        onClick={() => setOpenMenu(openMenu === item.label ? null : item.label)}
                      >
                        <ChevronIcon width={14} height={14} />
                      </button>
                    )}
                  </div>
                  <AnimatePresence>
                    {item.children && openMenu === item.label && (
                      <motion.ul
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="absolute left-0 top-full min-w-56 border border-line bg-coal py-3 shadow-2xl"
                      >
                        {item.children.map((c) => (
                          <li key={c.href}>
                            <Link href={c.href} className="block px-5 py-2.5 text-sm text-bone/80 hover:bg-graphite hover:text-paper">
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center text-paper hover:text-crimson"
            aria-label="Buscar"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <SearchIcon />
          </button>
          <Link href="/wishlist" className="relative hidden h-11 w-11 place-items-center text-paper hover:text-crimson sm:grid" aria-label="Wishlist">
            <HeartIcon />
            {hydrated && wishCount > 0 && <Badge n={wishCount} />}
          </Link>
          <Link href="/account" className="hidden h-11 w-11 place-items-center text-paper hover:text-crimson sm:grid" aria-label="Mi cuenta">
            <UserIcon />
          </Link>
          <button
            type="button"
            className="relative grid h-11 w-11 place-items-center text-paper hover:text-crimson"
            aria-label={`Carrito${hydrated ? `, ${count} productos` : ""}`}
            onClick={() => setCartOpen(true)}
          >
            <BagIcon />
            {hydrated && count > 0 && <Badge n={count} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-ink"
          >
            <form role="search" onSubmit={submitSearch} className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
              <SearchIcon className="text-smoke" />
              <label htmlFor="header-search" className="sr-only">
                Buscar productos
              </label>
              <input
                ref={searchRef}
                id="header-search"
                name="q"
                type="search"
                placeholder="Busca marca, modelo o referencia"
                className="h-12 flex-1 bg-transparent font-display text-lg text-paper placeholder:text-smoke focus:outline-none"
              />
              <button type="submit" className="btn btn-primary h-10 min-h-0 px-4">
                Buscar
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[60] bg-ink lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo size={44} />
              <button type="button" className="grid h-11 w-11 place-items-center" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <nav aria-label="Móvil" className="h-[calc(100dvh-4rem)] overflow-y-auto px-6 py-6">
              <ul className="space-y-1">
                {mainNav.map((item, i) => (
                  <motion.li key={item.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}>
                    <Link href={item.href} className="block py-3 font-display text-3xl font-semibold tracking-tight text-paper active:text-crimson">
                      {item.label}
                    </Link>
                    {item.children && (
                      <div className="flex flex-wrap gap-2 pb-3">
                        {item.children.map((c) => (
                          <Link key={c.href} href={c.href} className="border border-line px-3 py-2 text-xs text-bone/70">
                            {c.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </motion.li>
                ))}
              </ul>
              <div className="mt-8 grid grid-cols-2 gap-3 border-t border-line pt-6 text-sm">
                <Link href="/wishlist" className="btn btn-ghost">Wishlist</Link>
                <Link href="/account" className="btn btn-ghost">Mi cuenta</Link>
                <Link href="/orders/track" className="btn btn-ghost">Rastrear</Link>
                <Link href="/contact" className="btn btn-ghost">Contacto</Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crimson px-1 text-[10px] font-semibold text-paper">
      {n > 9 ? "9+" : n}
    </span>
  );
}
