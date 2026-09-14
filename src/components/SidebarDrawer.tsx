import React from "react";
import { X, Tv, Plus, Info, ShieldAlert, Check } from "lucide-react";
import { NovaSource } from "../types";

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sources: NovaSource[];
  activeSourceId: string | null;
  onSelectSource: (source: NovaSource) => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenDisclaimer: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  sources,
  activeSourceId,
  onSelectSource,
  onOpenSettings,
  onOpenAbout,
  onOpenDisclaimer,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer panel */}
      <div
        id="side"
        className="relative z-10 w-80 max-w-[85vw] bg-[#0c1017] border-r border-gray-800 h-full flex flex-col p-4 shadow-2xl text-white overflow-y-auto"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
              N
            </div>
            <span className="font-bold text-sm tracking-wide">NOVA PLAYER</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sources Navigation */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Mijn Verbindingen
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} />
              <span>Nieuw</span>
            </button>
          </div>

          <div id="sources" className="space-y-1.5 mb-6">
            {sources.length === 0 ? (
              <div className="text-center py-6 px-3 bg-[#111622] rounded-xl border border-gray-850">
                <Tv className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400 mb-2">Geen bronnen toegevoegd</p>
                <button
                  type="button"
                  id="connect"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Verbinden
                </button>
              </div>
            ) : (
              sources.map((src) => {
                const isActive = src.id === activeSourceId;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => {
                      onSelectSource(src);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer text-left ${
                      isActive
                        ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm"
                        : "bg-[#111622] border-gray-800/80 text-gray-300 hover:border-gray-700 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] px-1 py-0.5 rounded bg-black/40 text-gray-400 font-mono uppercase">
                        {src.type}
                      </span>
                      <span className="truncate">{src.name}</span>
                    </div>
                    {isActive && <Check size={14} className="text-indigo-400 flex-shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Stalker Series Feature Note */}
          <div className="bg-indigo-950/30 border border-indigo-900/60 rounded-xl p-3 mb-6">
            <h5 className="text-xs font-bold text-indigo-300 mb-1">Stalker Series & Episodes</h5>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Ondersteunt nu automatische seizoensdetectie, normalisatie van portaal-antwoorden en veilige create_link-koppeling met streaming proxy voor ongestoorde weergave.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-800 pt-3 space-y-1">
          <button
            type="button"
            id="aboutBtn"
            onClick={() => {
              onClose();
              onOpenAbout();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition cursor-pointer"
          >
            <Info size={14} />
            <span>Over Nova Player</span>
          </button>
          <button
            type="button"
            id="disclaimerBtn"
            onClick={() => {
              onClose();
              onOpenDisclaimer();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition cursor-pointer"
          >
            <ShieldAlert size={14} />
            <span>Disclaimer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
