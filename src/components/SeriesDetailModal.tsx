import React, { useState, useEffect } from "react";
import { Play, ArrowLeft, RotateCw, AlertCircle } from "lucide-react";
import { NovaSource, NovaItem } from "../types";
import { stalkerLoadSeriesEpisodes, xtreamLoadSeriesEpisodes } from "../services/novaApi";

interface SeriesDetailProps {
  show: NovaItem;
  source: NovaSource;
  onBack: () => void;
  onPlayEpisode: (episode: NovaItem) => void;
}

export const SeriesDetailView: React.FC<SeriesDetailProps> = ({
  show,
  source,
  onBack,
  onPlayEpisode,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Record<string, NovaItem[]>>({});
  const [allEpisodes, setAllEpisodes] = useState<NovaItem[]>([]);
  const [activeSeason, setActiveSeason] = useState<string>("all");

  const loadEpisodes = async (seasonNum?: string) => {
    setLoading(true);
    setError(null);
    try {
      if (source.type === "stalker") {
        const res = await stalkerLoadSeriesEpisodes(source, show, seasonNum);
        setSeasons(res.seasons);
        setAllEpisodes(res.episodes);

        const keys = Object.keys(res.seasons);
        if (keys.length > 0 && activeSeason === "all") {
          setActiveSeason(keys[0]);
        }
      } else if (source.type === "xtream") {
        const res = await xtreamLoadSeriesEpisodes(source, show);
        setSeasons(res.seasons);
        setAllEpisodes(res.episodes);

        const keys = Object.keys(res.seasons);
        if (keys.length > 0 && activeSeason === "all") {
          setActiveSeason(keys[0]);
        }
      } else {
        setError("Series afleveringen zijn beschikbaar voor Stalker en Xtream bronnen.");
      }
    } catch (err: any) {
      console.error("Failed to load series episodes:", err);
      setError(err.message || "Kon afleveringen niet ophalen van het Stalker portaal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [show.id]);

  const seasonKeys = Object.keys(seasons).sort((a, b) => Number(a) - Number(b));

  const visibleEpisodes =
    activeSeason === "all" || !seasons[activeSeason]
      ? allEpisodes
      : seasons[activeSeason] || [];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      {/* Header bar with Back button & Reload */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#151c29] border border-gray-800 hover:border-gray-700 text-white text-sm font-semibold transition cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Terug naar Series</span>
        </button>

        <button
          type="button"
          onClick={() => loadEpisodes(activeSeason !== "all" ? activeSeason : undefined)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#151c29] border border-gray-800 hover:border-indigo-500/60 text-gray-300 hover:text-white text-xs font-medium transition cursor-pointer disabled:opacity-50"
          title="Afleveringen opnieuw ophalen van Stalker portaal"
        >
          <RotateCw size={14} className={loading ? "animate-spin text-indigo-400" : ""} />
          <span>Herladen</span>
        </button>
      </div>

      {/* Series Hero Card */}
      <div className="bg-[#111622] border border-gray-800/80 rounded-2xl p-4 sm:p-6 mb-8 flex flex-col sm:flex-row gap-6 items-start">
        <div className="w-32 sm:w-44 flex-shrink-0 aspect-[2/3] bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-md relative">
          {show.logo ? (
            <img
              src={show.logo}
              alt={show.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-black text-gray-700">
              ▶
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-800/60 text-indigo-300 text-xs font-semibold mb-2">
            {show.group || "Series"}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight mb-2">
            {show.name}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-4">
            <span className="font-mono bg-black/40 px-2 py-0.5 rounded border border-gray-800">
              ID: {show.seriesId || show.id}
            </span>
            {source.type === "stalker" && (
              <span className="text-indigo-400">Stalker Portal Actief</span>
            )}
            <span>
              {allEpisodes.length} {allEpisodes.length === 1 ? "aflevering" : "afleveringen"} gevonden
            </span>
            {seasonKeys.length > 0 && (
              <span>• {seasonKeys.length} {seasonKeys.length === 1 ? "seizoen" : "seizoenen"}</span>
            )}
          </div>

          <p className="text-sm text-gray-300 leading-relaxed max-w-3xl">
            Kies hieronder een seizoen en aflevering om direct te bekijken. De stream wordt veilig geauthenticeerd via jouw Stalker sessie en verwerkt voor de speler.
          </p>
        </div>
      </div>

      {/* Season Selector Tabs */}
      {seasonKeys.length > 0 && (
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mr-2 flex-shrink-0">
            Seizoenen:
          </span>
          {seasonKeys.map((sKey) => (
            <button
              key={sKey}
              type="button"
              onClick={() => setActiveSeason(sKey)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeSeason === sKey
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500"
                  : "bg-[#151c29] text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700"
              }`}
            >
              Seizoen {sKey} ({seasons[sKey]?.length || 0})
            </button>
          ))}
          {seasonKeys.length > 1 && (
            <button
              type="button"
              onClick={() => setActiveSeason("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeSeason === "all"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500"
                  : "bg-[#151c29] text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700"
              }`}
            >
              Alle Seizoenen ({allEpisodes.length})
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
          <p className="text-sm font-semibold text-white">Stalker afleveringen worden uitgelezen...</p>
          <p className="text-xs text-gray-500 mt-1">
            Het portaal wordt opgevraagd met je MAC en autorisatie token.
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-rose-950/40 border border-rose-800 rounded-2xl p-6 text-center max-w-xl mx-auto my-8">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white mb-1">Afleveringen konden niet worden geladen</h3>
          <p className="text-xs text-rose-200 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => loadEpisodes()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Opnieuw proberen
          </button>
        </div>
      )}

      {/* Empty episodes message */}
      {!loading && !error && visibleEpisodes.length === 0 && (
        <div className="bg-[#111622] border border-gray-800 rounded-2xl p-8 text-center my-8">
          <p className="text-base font-bold text-white mb-1">Geen afleveringen gevonden</p>
          <p className="text-xs text-gray-400 max-w-md mx-auto mb-4">
            Dit Stalker portaal heeft voor deze serie geen losse afleveringen geretourneerd, of de serie vereist een andere seizoensopvraag.
          </p>
          <button
            type="button"
            onClick={() => loadEpisodes()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Nogmaals forceren via Stalker API
          </button>
        </div>
      )}

      {/* Episodes Grid / List */}
      {!loading && !error && visibleEpisodes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleEpisodes.map((ep, idx) => {
            const epNumber = ep.episodeNumber || idx + 1;
            const seasonLabel = ep.seasonNumber ? `S${String(ep.seasonNumber).padStart(2, "0")}` : "S01";
            const epLabel = `E${String(epNumber).padStart(2, "0")}`;

            return (
              <div
                key={ep.id || idx}
                onClick={() => onPlayEpisode(ep)}
                className="group bg-[#111622] hover:bg-[#161d2d] border border-gray-800/80 hover:border-indigo-500/50 rounded-xl p-3 flex gap-3.5 items-center transition cursor-pointer relative shadow-sm"
              >
                {/* Episode thumbnail */}
                <div className="w-24 h-16 flex-shrink-0 bg-gray-900 rounded-lg overflow-hidden border border-gray-800 relative flex items-center justify-center">
                  {ep.logo ? (
                    <img
                      src={ep.logo}
                      alt={ep.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-xs text-gray-600 font-bold">EP</span>
                  )}
                  {/* Play overlay icon */}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition">
                    <div className="w-7 h-7 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow group-hover:scale-110 transition">
                      <Play size={13} className="ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-800 text-indigo-300 font-mono">
                      {seasonLabel}{epLabel}
                    </span>
                    <span className="text-[11px] text-gray-500 truncate">
                      {ep.group || `Seizoen ${ep.seasonNumber || 1}`}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 truncate leading-snug">
                    {ep.name || `Aflevering ${epNumber}`}
                  </h4>
                  <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
                    CMD: {ep.cmd || `/media/${ep.id}.mpg`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
