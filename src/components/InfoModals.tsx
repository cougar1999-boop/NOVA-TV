import React from "react";
import { X, Tv, ShieldCheck, CheckCircle } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#111622] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-white relative">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-2">
            <Tv size={20} className="text-indigo-400" />
            <h3 className="text-base font-bold text-white">Over Nova Hybrid Player</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
          <p>
            <strong>Nova Hybrid Web & Android IPTV Player</strong> is ontworpen voor naadloze weergave van Live TV, Films en Series via Stalker/Ministra portals, Xtream Codes en M3U afspeellijsten.
          </p>

          <div className="bg-[#151c29] p-3 rounded-xl border border-gray-850 space-y-1.5">
            <h4 className="font-bold text-white text-xs mb-1">Verbeteringen Stalker Series:</h4>
            <div className="flex items-start gap-1.5 text-gray-400">
              <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Volledige seizoens- en afleveringenuitlezing via Stalker load.php</span>
            </div>
            <div className="flex items-start gap-1.5 text-gray-400">
              <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Automatische detectie van platte & geneste portaal-antwoorden</span>
            </div>
            <div className="flex items-start gap-1.5 text-gray-400">
              <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Veilige create_link-koppeling met stream proxy & Stalker auth</span>
            </div>
            <div className="flex items-start gap-1.5 text-gray-400">
              <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Android native bridge ondersteuning voor vloeiende weergave</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DisclaimerModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#111622] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-white relative">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-amber-400" />
            <h3 className="text-base font-bold text-white">Disclaimer</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2.5 text-xs text-gray-300 leading-relaxed">
          <p>
            Nova Player bevat zelf geen ingebouwde media, kanalen of streams. Gebruikers moeten hun eigen legitieme abonnementsgegevens, Stalker portals of M3U afspeellijsten configureren.
          </p>
          <p className="text-gray-400">
            Alle verzoeken verlopen veilig via de door de gebruiker geconfigureerde server en het Stalker Middleware portaal.
          </p>
        </div>
      </div>
    </div>
  );
};
