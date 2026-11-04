export const site = {
  name: "TR3S & CO.",
  descriptor: "ESENCIA · ESTILO · VISAJE",
  slogan: "TRES ALMAS UNA ESENCIA",
  description:
    "TR3S & CO. es una tienda multimarca de calzado deportivo y urbano en Bucaramanga, Colombia. Sneakers, running, streetwear y casual para hombre y mujer, con envíos a todo el país.",
  concept: "Tres amigos, tres personalidades y una misma esencia: el estilo urbano, la cultura sneaker y la moda deportiva.",
  city: "Bucaramanga, Santander, Colombia",
  logo: {
    original: "/brand/tr3s-logo-original.png",
    w640: "/brand/tr3s-logo-640.webp",
    w320: "/brand/tr3s-logo-320.webp",
    w160: "/brand/tr3s-logo-160.webp",
    alt: "TR3S & CO. — Esencia · Estilo · Visaje",
  },
};

export interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

export const mainNav: NavItem[] = [
  {
    label: "MEN",
    href: "/men",
    children: [
      { label: "Sneakers", href: "/men?category=sneakers" },
      { label: "Running", href: "/men?category=running" },
      { label: "Casual", href: "/men?category=casual" },
      { label: "Formal", href: "/men?category=formal" },
      { label: "Boots", href: "/men?category=boots" },
    ],
  },
  {
    label: "WOMEN",
    href: "/women",
    children: [
      { label: "Sneakers", href: "/women?category=sneakers" },
      { label: "Lifestyle", href: "/women?category=lifestyle" },
      { label: "Platforms", href: "/women?category=platforms" },
      { label: "Sandals", href: "/women?category=sandals" },
      { label: "Formal", href: "/women?category=formal" },
    ],
  },
  {
    label: "SNEAKERS",
    href: "/sneakers",
    children: [
      { label: "Todos los sneakers", href: "/sneakers" },
      { label: "Streetwear", href: "/streetwear" },
      { label: "Lifestyle", href: "/sneakers?category=lifestyle" },
      { label: "Casual", href: "/sneakers?category=casual" },
    ],
  },
  {
    label: "SPORTS",
    href: "/sports",
    children: [
      { label: "Running", href: "/sports?category=running" },
      { label: "Training", href: "/sports?category=training" },
    ],
  },
  { label: "BRANDS", href: "/brands" },
  { label: "NEW ARRIVALS", href: "/new-arrivals" },
  { label: "SALE", href: "/sale" },
];

export const policyPages = [
  { slug: "envios", title: "Envíos" },
  { slug: "cambios-y-devoluciones", title: "Cambios y devoluciones" },
  { slug: "garantias", title: "Garantías" },
  { slug: "privacidad", title: "Privacidad y datos personales" },
  { slug: "terminos", title: "Términos y condiciones" },
] as const;
