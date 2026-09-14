import React, { useState, useEffect } from "react";
import { Calendar, Play } from "lucide-react";
import { NovaSource, NovaItem, EpgProgram } from "../types";
import { xtreamQuery } from "../services/novaApi";

interface EpgViewProps {
  source: NovaSource | null;
  channels: NovaItem[];
  onPlayChannel: (channel: NovaItem) => void;
}

export const EpgView: React.FC<EpgViewProps> = ({ source, channels, onPlayChannel }) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [programs, setPrograms] = useState<EpgProgram[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels]);

  useEffect(() => {
    if (!selectedChannelId || !source || source.type !== "xtream") return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadEpg() {
      try {
        const data = await xtreamQuery(source!, {
          action: "get_short_epg",
          stream_id: selectedChannelId,
          limit: "50",
        });

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.epg_listings)
          ? data.epg_listings
          : Array.isArray(data?.epg_list)
          ? data.epg_list
          : [];

        if (isMounted) {
          setPrograms(
            list.map((p: any) => ({
              title: p.title || p.name || p.programme || "Programma",
              start: p.start || p.start_timestamp,
              stop: p.end || p.stop || p.end_timestamp,
              description: p.description || p.desc || "",
            }))
          );
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "EPG kon niet worden geladen");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadEpg();

    return () => {
      isMounted = false;
    };
  }, [selectedChannelId, source]);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  const formatTime = (val?: string | number) => {
    if (!val) return "";
    const str = String(val);
    if (/^\d+$/.test(str)) {
      const n = Number(str);
      const d = new Date(n < 100000000000 ? n * 1000 : n);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const match = str.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
    return str;
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      <div className="bg-[#111622] border border-gray-800 rounded-2xl p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Elektronische Programmagids (EPG)</h2>
          </div>

          {selectedChannel && (
            <button
              type="button"
              onClick={() => onPlayChannel(selectedChannel)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition cursor-pointer"
            >
              <Play size={14} fill="currentColor" />
              <span>Nu kijken: {selectedChannel.name}</span>
            </button>
          )}
        </div>

        {/* Channel Selector */}
        <div className="mb-6">
          <label htmlFor="epgChannelSelect" className="block text-xs font-semibold text-gray-400 mb-1.5">
            Kies een kanaal:
          </label>
          <select
            id="epgChannelSelect"
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            className="w-full bg-[#151c29] border border-gray-800 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name} ({ch.group || "Live TV"})
              </option>
            ))}
          </select>
        </div>

        {/* Programs List */}
        {loading && (
          <div className="py-12 text-center text-xs text-gray-400">
            <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
            EPG wordt geladen...
          </div>
        )}

        {!loading && error && (
          <div className="p-4 bg-rose-950/30 border border-rose-800 text-rose-300 text-xs rounded-xl text-center">
            {error}
          </div>
        )}

        {!loading && !error && programs.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-400">
            Geen programma-informatie beschikbaar voor dit kanaal.
          </div>
        )}

        {!loading && !error && programs.length > 0 && (
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {programs.map((p, idx) => {
              const startTime = formatTime(p.start);
              const stopTime = formatTime(p.stop);
              const timeRange = startTime && stopTime ? `${startTime} - ${stopTime}` : startTime || "";

              return (
                <div
                  key={idx}
                  className="p-3.5 bg-[#151c29] border border-gray-850 hover:border-gray-750 rounded-xl transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-3 mb-1">
                    {timeRange && (
                      <span className="text-xs font-mono font-bold text-indigo-300 flex-shrink-0">
                        {timeRange}
                      </span>
                    )}
                    <h4 className="text-xs sm:text-sm font-bold text-white">{p.title}</h4>
                  </div>
                  {p.description && (
                    <p className="text-[11px] text-gray-400 leading-relaxed mt-1">
                      {p.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
