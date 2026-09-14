import React from "react";
import { Star, Play, Clapperboard, Tv } from "lucide-react";
import { NovaItem } from "../types";

interface MediaGridProps {
  view: "live" | "movies" | "series" | "epg";
  items: NovaItem[];
  favorites: string[];
  onToggleFavorite: (item: NovaItem) => void;
  onSelectItem: (item: NovaItem) => void;
  loading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  view,
  items,
  favorites,
  onToggleFavorite,
  onSelectItem,
  loading,
  onLoadMore,
  hasMore,
}) => {
  if (loading && items.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-white">Media wordt geladen...</p>
        <p className="text-xs text-gray-500 mt-1">Gegevens worden opgehaald van het portaal.</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto my-16 p-8 text-center bg-[#111622] rounded-2xl border border-gray-800">
        <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-3 text-gray-400">
          {view === "live" ? <Tv size={24} /> : <Clapperboard size={24} />}
        </div>
        <h3 className="text-base font-bold text-white mb-1">Geen kanalen of media gevonden</h3>
        <p className="text-xs text-gray-400">
          Controleer je geselecteerde categorie of zoekopdracht, of voeg een geldige Stalker/Xtream verbinding toe via Instellingen.
        </p>
      </div>
    );
  }

  // MOVIES & SERIES: Poster Grid (aspect 2:3)
  if (view === "movies" || view === "series") {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => {
            const isFav = favorites.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="group relative bg-[#111622] hover:bg-[#161d2d] border border-gray-850 hover:border-indigo-500/60 rounded-2xl overflow-hidden shadow-sm transition duration-200 cursor-pointer flex flex-col"
              >
                {/* Poster container */}
                <div className="relative aspect-[2/3] w-full bg-gray-900 flex items-center justify-center overflow-hidden">
                  {item.logo ? (
                    <img
                      src={item.logo}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-3xl text-gray-700 font-black">▶</span>
                  )}

                  {/* Play badge overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                      <Play size={20} className="ml-1" fill="currentColor" />
                    </div>
                  </div>

                  {/* Top tags */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/70 text-gray-300 backdrop-blur-xs">
                      {view === "series" ? "Serie" : "Film"}
                    </span>
                    {item.year && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/70 text-gray-300 backdrop-blur-xs">
                        {item.year}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body details */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 truncate leading-snug mb-1">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-gray-400 truncate">{item.group || "Media"}</p>
                  </div>

                  {view === "series" && (
                    <div className="mt-2 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-indigo-400 font-semibold">
                      <span>Bekijk afleveringen</span>
                      <span>→</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Items laden..." : "Meer laden"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // LIVE TV: Channel List Cards
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((channel) => {
          const isFav = favorites.includes(channel.id);

          return (
            <div
              key={channel.id}
              onClick={() => onSelectItem(channel)}
              className="group bg-[#111622] hover:bg-[#161d2d] border border-gray-850 hover:border-indigo-500/50 rounded-xl p-3 flex items-center gap-3 transition cursor-pointer relative shadow-sm"
            >
              {/* Logo / Thumbnail */}
              <div className="w-14 h-11 flex-shrink-0 bg-gray-900 rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center p-1">
                {channel.logo ? (
                  <img
                    src={channel.logo}
                    alt={channel.name}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-xs font-black text-gray-600">TV</span>
                )}
              </div>

              {/* Title & Group */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {channel.number && (
                    <span className="text-[10px] font-mono font-bold text-gray-500 bg-black/40 px-1 py-0.2 rounded">
                      {channel.number}
                    </span>
                  )}
                  <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 truncate">
                    {channel.name}
                  </h4>
                </div>
                <p className="text-[11px] text-gray-400 truncate">{channel.group || "Live TV"}</p>
              </div>

              {/* Favorite button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(channel);
                }}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isFav
                    ? "text-amber-400 hover:text-amber-300"
                    : "text-gray-600 hover:text-gray-400"
                }`}
                title={isFav ? "Verwijderen uit favorieten" : "Toevoegen aan favorieten"}
              >
                <Star size={16} fill={isFav ? "currentColor" : "none"} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
