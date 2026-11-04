"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { ArrowIcon, BagIcon, ChevronIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from "@/components/icons";
import { mainNav, site } from "@/lib/site";
import { cn } from "@/lib/format";
import { useCart } from "@/features/cart/store";
import { useWishlist } from "@/features/wishlist/store";
import { useHydrated } from "@/hooks/useHydrated";

const quickSearches = [
  { label: "Sneakers", href: "/sneakers" },
  { label: "Running", href: "/sports?category=running" },
  { label: "Hombre", href: "/men" },
  { label: "Mujer", href: "/women" },
  { label: "Streetwear", href: "/streetwear" },
  { label: "Sale", href: "/sale" },
];

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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCount = useRef(count);

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

  // Visual feedback when something lands in the bag
  useEffect(() => {
    if (hydrated && count > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 600);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count, hydrated]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, searchOpen]);

  const submitSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const enter = (label: string | null) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(label);
  };
  const leave = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };
  const activeItem = mainNav.find((n) => n.label === openMenu);
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <header className={cn("sticky top-0 z-50 transition-[background-color,border-color] duration-300", scrolled || openMenu ? "border-b border-line bg-ink/95 backdrop-blur-md" : "border-b border-transparent bg-ink")}>
      <div className="mx-auto grid h-16 max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:h-[76px] md:px-8 lg:grid-cols-[auto_1fr_auto]">
        {/* left: menu (mobile) + logo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="-ml-2 grid h-11 w-11 place-items-center text-paper transition-colors hover:text-crimson lg:hidden"
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>
          <span className="hidden lg:inline-flex">
            <Logo size={54} priority />
          </span>
        </div>
        <span className="justify-self-center lg:hidden">
          <Logo size={46} priority />
        </span>

        {/* center: desktop navigation */}
        <nav aria-label="Principal" className="hidden justify-self-center lg:block" onMouseLeave={leave}>
          <ul className="flex items-center">
            {mainNav.map((item) => (
              <li key={item.label} onMouseEnter={() => enter(item.children ? item.label : null)} className="flex items-center">
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "link-underline px-0 py-1 font-display text-[12px] font-semibold tracking-[0.2em] transition-colors xl:text-[13px]",
                    item.label === "SALE" ? "text-crimson hover:text-paper" : "text-paper hover:text-paper/80",
                  )}
                >
                  {item.label}
                </Link>
                {item.children ? (
                  <button
                    type="button"
                    className="mr-4 ml-1 grid h-8 w-5 place-items-center text-smoke transition-colors hover:text-paper xl:mr-6"
                    aria-label={`Abrir submenú ${item.label}`}
                    aria-expanded={openMenu === item.label}
                    onClick={() => setOpenMenu(openMenu === item.label ? null : item.label)}
                  >
                    <ChevronIcon width={13} height={13} className={cn("transition-transform duration-300", openMenu === item.label && "rotate-180")} />
                  </button>
                ) : (
                  <span className="w-5 xl:w-7" />
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* right: actions */}
        <div className="flex items-center justify-self-end">
          <IconButton label="Buscar" onClick={() => setSearchOpen(true)} expanded={searchOpen}>
            <SearchIcon />
          </IconButton>
          <Link href="/wishlist" className="relative hidden h-11 w-11 place-items-center text-paper transition-colors hover:text-crimson sm:grid" aria-label={`Favoritos${hydrated && wishCount ? `, ${wishCount}` : ""}`}>
            <HeartIcon />
            {hydrated && wishCount > 0 && <Badge n={wishCount} />}
          </Link>
          <Link href="/account" className="hidden h-11 w-11 place-items-center text-paper transition-colors hover:text-crimson sm:grid" aria-label="Mi cuenta">
            <UserIcon />
          </Link>
          <motion.button
            type="button"
            animate={bump ? { scale: [1, 1.25, 0.95, 1] } : { scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative grid h-11 w-11 place-items-center text-paper transition-colors hover:text-crimson"
            aria-label={`Carrito${hydrated ? `, ${count} productos` : ""}`}
            onClick={() => setCartOpen(true)}
          >
            <BagIcon />
            {hydrated && count > 0 && <Badge n={count} />}
          </motion.button>
        </div>
      </div>

      {/* desktop mega menu */}
      <AnimatePresence>
        {activeItem?.children && (
          <motion.div
            key={activeItem.label}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full hidden border-b border-line bg-ink shadow-[0_30px_60px_rgba(0,0,0,0.6)] lg:block"
            onMouseEnter={() => enter(activeItem.label)}
            onMouseLeave={leave}
          >
            <div className="mx-auto grid max-w-[1600px] grid-cols-12 gap-8 px-8 py-10">
              <div className="col-span-3">
                <p className="eyebrow mb-3">{site.name}</p>
                <p className="headline text-6xl text-paper">{activeItem.label}</p>
                <Link href={activeItem.href} className="mt-6 inline-flex items-center gap-2 font-display text-xs font-semibold tracking-[0.2em] text-paper hover:text-crimson">
                  VER TODO <ArrowIcon width={16} />
                </Link>
              </div>
              <ul className="col-span-5 grid grid-cols-2 content-start gap-x-8 gap-y-1">
                {activeItem.children.map((c, i) => (
                  <motion.li key={c.href} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}>
                    <Link href={c.href} className="group flex items-center justify-between border-b border-line py-3 text-[15px] text-bone/80 transition-colors hover:text-paper">
                      {c.label}
                      <ArrowIcon width={14} className="-translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <Link href={activeItem.href} className="group relative col-span-4 overflow-hidden border border-line bg-coal p-6 stripes">
                <span className="eyebrow text-crimson">Esencia · Estilo · Visaje</span>
                <span className="headline mt-3 block text-4xl text-paper">{activeItem.label === "SPORTS" ? "MUÉVETE CON ESTILO" : activeItem.label === "WOMEN" ? "TU PASO, TU REGLA" : "TU ESTILO. TU CAMINO."}</span>
                <span className="mt-6 inline-flex items-center gap-2 text-xs tracking-[0.2em] text-bone/80 group-hover:text-paper">
                  DESCUBRIR <ArrowIcon width={14} className="transition-transform group-hover:translate-x-1" />
                </span>
                <span aria-hidden className="pointer-events-none absolute -bottom-6 -right-2 headline text-[8rem] text-outline opacity-60">TR3S</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div className="fixed inset-0 z-[65]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Cerrar búsqueda" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Buscar"
              initial={{ y: -30 }}
              animate={{ y: 0 }}
              exit={{ y: -30 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative border-b border-line bg-ink"
            >
              <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
                <div className="flex items-center justify-between">
                  <p className="eyebrow">Buscar en TR3S &amp; CO.</p>
                  <button type="button" className="grid h-11 w-11 place-items-center text-paper hover:text-crimson" aria-label="Cerrar búsqueda" onClick={() => setSearchOpen(false)}>
                    <CloseIcon />
                  </button>
                </div>
                <form role="search" onSubmit={submitSearch} className="mt-2 flex items-center gap-3 border-b-2 border-paper/20 pb-3 focus-within:border-crimson">
                  <SearchIcon className="text-smoke" width={24} height={24} />
                  <label htmlFor="header-search" className="sr-only">Buscar productos</label>
                  <input
                    ref={searchRef}
                    id="header-search"
                    name="q"
                    type="search"
                    autoComplete="off"
                    placeholder="Marca, modelo o referencia"
                    className="h-14 min-w-0 flex-1 bg-transparent font-display text-2xl text-paper placeholder:text-smoke focus:outline-none md:text-3xl"
                  />
                  <button type="submit" className="btn btn-primary h-11 min-h-0 px-5">Buscar</button>
                </form>
                <p className="eyebrow mt-6 mb-3">Explora</p>
                <div className="flex flex-wrap gap-2">
                  {quickSearches.map((q) => (
                    <Link key={q.href} href={q.href} onClick={() => setSearchOpen(false)} className="border border-line px-4 py-2 text-sm text-bone/80 transition-colors hover:border-crimson hover:text-paper">
                      {q.label}
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
              className="relative flex h-full w-[min(88vw,420px)] flex-col border-r border-line bg-ink"
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
                <Logo size={42} />
                <button type="button" className="grid h-11 w-11 place-items-center" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}>
                  <CloseIcon />
                </button>
              </div>
              <nav aria-label="Móvil" className="flex-1 overflow-y-auto px-5 py-4">
                <ul>
                  {mainNav.map((item, i) => (
                    <motion.li key={item.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }} className="border-b border-line">
                      <div className="flex items-center">
                        <Link href={item.href} className={cn("headline flex-1 py-4 text-[2rem] tracking-wide", item.label === "SALE" ? "text-crimson" : "text-paper", isActive(item.href) && "text-crimson")}>
                          {item.label}
                        </Link>
                        {item.children && (
                          <button
                            type="button"
                            className="grid h-11 w-11 place-items-center text-smoke"
                            aria-label={`Ver categorías de ${item.label}`}
                            aria-expanded={expanded === item.label}
                            onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                          >
                            <ChevronIcon className={cn("transition-transform", expanded === item.label && "rotate-180")} />
                          </button>
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {item.children && expanded === item.label && (
                          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-3">
                            {item.children.map((c) => (
                              <li key={c.href}>
                                <Link href={c.href} className="block py-2 pl-1 text-[15px] text-bone/75 active:text-crimson">{c.label}</Link>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  ))}
                </ul>
                <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
                  <Link href="/account" className="btn btn-ghost"><UserIcon width={16} /> Mi cuenta</Link>
                  <Link href="/wishlist" className="btn btn-ghost"><HeartIcon width={16} /> Favoritos</Link>
                  <Link href="/orders/track" className="btn btn-ghost">Rastrear pedido</Link>
                  <Link href="/contact" className="btn btn-ghost">Contacto</Link>
                </div>
              </nav>
              <p className="shrink-0 border-t border-line px-5 py-4 font-display text-[10px] tracking-[0.3em] text-smoke">{site.descriptor}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function IconButton({ label, onClick, expanded, children }: { label: string; onClick: () => void; expanded?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className="grid h-11 w-11 place-items-center text-paper transition-colors hover:text-crimson" aria-label={label} aria-expanded={expanded} onClick={onClick}>
      {children}
    </button>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crimson px-1 text-[10px] font-semibold text-paper">
      {n > 9 ? "9+" : n}
    </span>
  );
}
