import { WhatsappIcon } from "@/components/icons";
import { whatsappLink } from "@/services/whatsapp";

/** Floating WhatsApp button. Hidden entirely when no number is configured (never a dead button). */
export function WhatsAppFloat({ number }: { number: string | null }) {
  const href = whatsappLink(number, "Hola TR3S & CO. Necesito ayuda con una compra.");
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#1f8f4e] text-paper shadow-2xl shadow-black/50 transition-transform hover:scale-105"
    >
      <WhatsappIcon width={26} height={26} />
    </a>
  );
}
