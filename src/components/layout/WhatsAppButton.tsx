import { MessageCircle } from "lucide-react";

export function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/6588254821?text=Hi%2C%20I%27d%20like%20to%20enquire%20about%20your%20properties."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] hover:bg-[#20BD5A] rounded-full flex items-center justify-center shadow-elevated transition-transform hover:scale-110 animate-float"
      aria-label="WhatsApp us"
    >
      <MessageCircle size={26} className="text-white" />
    </a>
  );
}
