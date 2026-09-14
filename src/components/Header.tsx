import React from "react";
import { Tv, Film, Clapperboard, Calendar, Menu, Settings, Search } from "lucide-react";
import { NovaSource, NovaCategory } from "../types";

interface HeaderProps {
  view: "live" | "movies" | "series" | "epg";
  onViewChange: (view: "live" | "movies" | "series" | "epg") => void;
  activeSource: NovaSource | null;
  categories: NovaCategory[];
  selectedCategory: string;
  onCategoryChange: (catId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSettings: () => void;
  onOpenSidebar: () => void;
  connectionStatus: { state: "idle" | "connecting" | "connected" | "error"; message?: string };
}

export const Header: React.FC<HeaderProps> = ({
  view,
  onViewChange,
  activeSource,
  categories,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  onOpenSettings,
  onOpenSidebar,
  connectionStatus,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0c1017]/95 backdrop-blur border-b border-gray-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Connection button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              id="menu"
              onClick={onOpenSidebar}
              className="p-2 rounded-lg bg-[#151c29] border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition cursor-pointer"
              title="Menu & Opgeslagen bronnen"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-base shadow-sm">
                N
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-wide leading-none">NOVA</h1>
                <p className="text-[10px] text-gray-400 leading-tight">Hybrid Player</p>
              </div>
            </div>
          </div>

          {/* Active connection status pill */}
          <div className="flex items-center gap-2">
            <div
              className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-medium ${
                connectionStatus.state === "connected"
                  ? "bg-emerald-950/50 border-emerald-800 text-emerald-300"
                  : connectionStatus.state === "connecting"
                  ? "bg-amber-950/50 border-amber-800 text-amber-300 animate-pulse"
                  : connectionStatus.state === "error"
                  ? "bg-rose-950/50 border-rose-800 text-rose-300"
                  : "bg-gray-900 border-gray-800 text-gray-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus.state === "connected"
                    ? "bg-emerald-400"
                    : connectionStatus.state === "connecting"
                    ? "bg-amber-400"
                    : connectionStatus.state === "error"
                    ? "bg-rose-400"
                    : "bg-gray-500"
                }`}
              />
              <span className="max-w-[140px] truncate">
                {activeSource ? activeSource.name : "Geen verbinding"}
              </span>
            </div>

            <button
              type="button"
              id="settings"
              onClick={onOpenSettings}
              className="p-2 rounded-lg bg-[#151c29] border border-gray-800 hover:border-indigo-500/50 text-gray-300 hover:text-white transition cursor-pointer"
              title="Instellingen & Portals"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Media Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-[#151c29] p-1 rounded-xl border border-gray-800/80 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => onViewChange("live")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              view === "live"
                ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Tv size={14} />
            <span>Live TV</span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange("movies")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              view === "movies"
                ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Film size={14} />
            <span>Films</span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange("series")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              view === "series"
                ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Clapperboard size={14} />
            <span>Series</span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange("epg")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              view === "epg"
                ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Calendar size={14} />
            <span>Gids / EPG</span>
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2">
          {view !== "epg" && (
            <>
              {/* Category selector */}
              <div className="relative min-w-[140px] max-w-[190px]">
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full bg-[#151c29] border border-gray-800 text-gray-200 text-xs rounded-lg px-2.5 py-2 pr-6 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer truncate"
                >
                  <option value="all">Alle categorieën</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 text-xs">
                  ▼
                </div>
              </div>

              {/* Search bar */}
              <div className="relative flex-1 sm:w-48">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Zoeken..."
                  className="w-full bg-[#151c29] border border-gray-800 text-gray-200 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
