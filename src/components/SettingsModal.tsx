import React, { useState } from "react";
import { X, Tv, Server, FileText, Upload, Trash2, CheckCircle2 } from "lucide-react";
import { NovaSource } from "../types";
import { parseM3U } from "../services/novaApi";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: NovaSource[];
  activeSourceId: string | null;
  onAddSource: (source: NovaSource) => Promise<void>;
  onRemoveSource: (id: string) => Promise<void>;
  onSelectSource: (source: NovaSource) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  sources,
  activeSourceId,
  onAddSource,
  onRemoveSource,
  onSelectSource,
}) => {
  const [tab, setTab] = useState<"stalker" | "xtream" | "m3u_url" | "m3u_file">("stalker");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Stalker form state
  const [stalkerPortal, setStalkerPortal] = useState<string>("");
  const [stalkerMac, setStalkerMac] = useState<string>("");
  const [stalkerModel, setStalkerModel] = useState<string>("MAG254");

  // Xtream form state
  const [xtreamServer, setXtreamServer] = useState<string>("");
  const [xtreamUser, setXtreamUser] = useState<string>("");
  const [xtreamPass, setXtreamPass] = useState<string>("");

  // M3U form state
  const [m3uUrl, setM3uUrl] = useState<string>("");

  if (!isOpen) return null;

  const handleAddStalker = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanPortal = stalkerPortal.trim().replace(/\/+$/, "") + "/";
      const cleanMac = stalkerMac.toUpperCase().replace(/[^0-9A-F:]/g, "");

      if (!cleanPortal) throw new Error("Voer een geldige Stalker portal URL in.");
      if (!cleanMac) throw new Error("Voer een geldig MAC-adres in (bijv. 00:1A:79:XX:XX:XX).");

      const newSource: NovaSource = {
        id: "src-" + Date.now().toString(36),
        type: "stalker",
        name: `MAC ${cleanMac}`,
        portal: cleanPortal,
        mac: cleanMac,
        model: stalkerModel || "MAG254",
      };

      await onAddSource(newSource);
      onClose();
    } catch (err: any) {
      setError(err.message || "Kon Stalker verbinding niet toevoegen.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddXtream = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!xtreamServer) throw new Error("Voer een server URL in.");
      if (!xtreamUser || !xtreamPass) throw new Error("Gebruikersnaam en wachtwoord zijn verplicht.");

      const newSource: NovaSource = {
        id: "src-" + Date.now().toString(36),
        type: "xtream",
        name: `Xtream ${xtreamUser}`,
        server: xtreamServer.trim().replace(/\/+$/, ""),
        username: xtreamUser.trim(),
        password: xtreamPass,
      };

      await onAddSource(newSource);
      onClose();
    } catch (err: any) {
      setError(err.message || "Kon Xtream verbinding niet toevoegen.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddM3uUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!m3uUrl) throw new Error("Voer een M3U URL in.");

      const newSource: NovaSource = {
        id: "src-" + Date.now().toString(36),
        type: "m3u",
        name: m3uUrl.slice(0, 35) + "...",
        url: m3uUrl.trim(),
      };

      await onAddSource(newSource);
      onClose();
    } catch (err: any) {
      setError(err.message || "Kon M3U URL niet laden.");
    } finally {
      setLoading(false);
    }
  };

  const handleM3uFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const text = reader.result as string;
          const items = parseM3U(text);

          const newSource: NovaSource = {
            id: "src-" + Date.now().toString(36),
            type: "m3u",
            name: file.name,
            fileName: file.name,
            allItems: items,
            items: items,
          };

          await onAddSource(newSource);
          onClose();
        } catch (err: any) {
          setError(err.message || "Kon lokaal M3U bestand niet verwerken.");
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setError("Fout bij het lezen van bestand.");
        setLoading(false);
      };
      reader.readAsText(file);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      id="settingsBox"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-[#111622] border border-gray-800 rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-2xl text-white relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-5">
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">IPTV Verbindingen & Portals</h3>
            <p className="text-xs text-gray-400">Beheer Stalker portals, Xtream Codes en M3U playlists</p>
          </div>
          <button
            type="button"
            id="closeSettings"
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        {/* Source Type Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#151c29] rounded-xl border border-gray-800 mb-5">
          <button
            type="button"
            onClick={() => setTab("stalker")}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === "stalker"
                ? "bg-indigo-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Tv size={14} />
            <span>Stalker</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("xtream")}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === "xtream"
                ? "bg-indigo-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Server size={14} />
            <span>Xtream</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("m3u_url")}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === "m3u_url"
                ? "bg-indigo-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FileText size={14} />
            <span>M3U URL</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("m3u_file")}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === "m3u_file"
                ? "bg-indigo-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Upload size={14} />
            <span>M3U File</span>
          </button>
        </div>

        {/* Stalker Form */}
        {tab === "stalker" && (
          <form id="stalker" onSubmit={handleAddStalker} className="space-y-3.5 mb-6">
            <div>
              <label htmlFor="portal" className="block text-xs font-semibold text-gray-300 mb-1">
                Stalker / Ministra Portal URL
              </label>
              <input
                id="portal"
                type="url"
                required
                value={stalkerPortal}
                onChange={(e) => setStalkerPortal(e.target.value)}
                placeholder="http://portal.example.com/c/"
                className="w-full bg-[#151c29] border border-gray-800 text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label htmlFor="mac" className="block text-xs font-semibold text-gray-300 mb-1">
                MAC Adres
              </label>
              <input
                id="mac"
                type="text"
                required
                maxLength={17}
                value={stalkerMac}
                onChange={(e) => setStalkerMac(e.target.value)}
                placeholder="00:1A:79:XX:XX:XX"
                className="w-full bg-[#151c29] border border-gray-800 text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 font-mono uppercase"
              />
            </div>
            <div>
              <label htmlFor="model" className="block text-xs font-semibold text-gray-300 mb-1">
                STB Model
              </label>
              <select
                id="model"
                value={stalkerModel}
                onChange={(e) => setStalkerModel(e.target.value)}
                className="w-full bg-[#151c29] border border-gray-800 text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="MAG254">MAG254 (Aanbevolen)</option>
                <option value="MAG250">MAG250</option>
                <option value="MAG256">MAG256</option>
                <option value="MAG322">MAG322</option>
                <option value="MAG420">MAG420</option>
                <option value="MAG520">MAG520</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 shadow-md"
            >
              {loading ? "Verbinden met Stalker..." : "Verbinden met Stalker Portal"}
            </button>
          </form>
        )}

        {/* Xtream Form */}
        {tab === "xtream" && (
          <form id="xtream" onSubmit={handleAddXtream} className="space-y-3.5 mb-6">
            <div>
              <label htmlFor="server" className="block text-xs font-semibold text-gray-300 mb-1">
                Server URL
              </label>
              <input
                id="server"
                type="url"
                required
                value={xtreamServer}
                onChange={(e) => setXtreamServer(e.target.value)}
                placeholder="http://server.example.com:8080"
                className="w-full bg-[#151c29] border border-gray-800 text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="user" className="block text-xs font-semibold text-gray-300 mb-1">
                  Gebruikersnaam
                </label>
                <input
                  id="user"
                  type="text"
                  required
                  value={xtreamUser}
                  onChange={(e) => setXtreamUser(e.target.value)}
                  className="w-full bg-[#151c29] border border-gray-800 text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="pass" className="block text-xs font-semibold text-gray-300 mb-1">
                  Wachtwoord
                </label>
                <input
                  id="pass"
                  type="password"
                  required
                  value={xtreamPass}
                  onChange={(e) => setXtreamPass(e.target.value)}
                  className="w-full bg-[#151c29] border border-gray-800 text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 shadow-md"
            >
              {loading ? "Verbinden..." : "Verbinden met Xtream"}
            </button>
          </form>
        )}

        {/* M3U URL Form */}
        {tab === "m3u_url" && (
          <form id="m3u" onSubmit={handleAddM3uUrl} className="space-y-3.5 mb-6">
            <div>
              <label htmlFor="m3uurl" className="block text-xs font-semibold text-gray-300 mb-1">
                M3U Playlist URL
              </label>
              <input
                id="m3uurl"
                type="url"
                required
                value={m3uUrl}
                onChange={(e) => setM3uUrl(e.target.value)}
                placeholder="https://example.com/playlist.m3u"
                className="w-full bg-[#151c29] border border-gray-800 text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 shadow-md"
            >
              {loading ? "Playlist downloaden..." : "M3U Playlist Laden"}
            </button>
          </form>
        )}

        {/* M3U File Form */}
        {tab === "m3u_file" && (
          <div className="mb-6">
            <label
              htmlFor="m3ufile"
              className="border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-[#151c29]"
            >
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-xs font-bold text-white mb-1">
                Selecteer een .m3u of .m3u8 bestand
              </span>
              <span className="text-[11px] text-gray-500">
                Wordt direct lokaal in je browser verwerkt
              </span>
              <input
                id="m3ufile"
                type="file"
                accept=".m3u,.m3u8"
                onChange={handleM3uFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Saved Connections List */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Opgeslagen bronnen ({sources.length})
          </h4>
          {sources.length === 0 ? (
            <p className="text-xs text-gray-500 py-3 text-center bg-[#151c29] rounded-xl border border-gray-800">
              Nog geen bronnen opgeslagen.
            </p>
          ) : (
            <div id="saved" className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {sources.map((src) => {
                const isActive = src.id === activeSourceId;
                return (
                  <div
                    key={src.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                      isActive
                        ? "bg-indigo-950/40 border-indigo-700 text-white"
                        : "bg-[#151c29] border-gray-800 text-gray-300"
                    }`}
                  >
                    <div
                      onClick={() => {
                        onSelectSource(src);
                        onClose();
                      }}
                      className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                    >
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-black/40 border border-gray-700 text-gray-400">
                        {src.type}
                      </span>
                      <span className="font-semibold truncate">{src.name}</span>
                      {isActive && (
                        <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 ml-1" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveSource(src.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer ml-2"
                      title="Verwijderen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
