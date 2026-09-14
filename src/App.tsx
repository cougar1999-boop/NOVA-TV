import React, { useState, useEffect, useMemo } from "react";
import { Header } from "./components/Header";
import { MediaGrid } from "./components/MediaGrid";
import { SeriesDetailView } from "./components/SeriesDetailModal";
import { PlayerModal } from "./components/PlayerModal";
import { SettingsModal } from "./components/SettingsModal";
import { SidebarDrawer } from "./components/SidebarDrawer";
import { EpgView } from "./components/EpgView";
import { AboutModal, DisclaimerModal } from "./components/InfoModals";
import { NovaSource, NovaItem, NovaCategory } from "./types";
import {
  loadStoredSources,
  saveStoredSources,
  saveSourceItemsToDB,
  loadSourceItemsFromDB,
  loadFavorites,
  saveFavorites,
  dbDelete,
} from "./services/novaStorage";
import {
  stalkerLoadChannels,
  stalkerLoadMovies,
  stalkerLoadSeries,
  xtreamLoadChannels,
  xtreamLoadMovies,
  xtreamLoadSeries,
  fetchM3U,
} from "./services/novaApi";
import { Tv, Sparkles, Plus, Clapperboard, Film } from "lucide-react";

export default function App() {
  const [sources, setSources] = useState<NovaSource[]>([]);
  const [activeSource, setActiveSource] = useState<NovaSource | null>(null);
  const [view, setView] = useState<"live" | "movies" | "series" | "epg">("live");

  // Media items & categories
  const [items, setItems] = useState<NovaItem[]>([]);
  const [categories, setCategories] = useState<NovaCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [favorites, setFavoritesState] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  // Selected Series for Detail/Episode viewer
  const [selectedSeriesShow, setSelectedSeriesShow] = useState<NovaItem | null>(null);

  // Active playing item for Player Modal
  const [playingItem, setPlayingItem] = useState<NovaItem | null>(null);

  // Modals & Drawers
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState<boolean>(false);

  // Connection status pill
  const [connectionStatus, setConnectionStatus] = useState<{
    state: "idle" | "connecting" | "connected" | "error";
    message?: string;
  }>({ state: "idle" });

  // 1. Initial startup: load sources and favorites from storage
  useEffect(() => {
    const loadedSources = loadStoredSources();
    setSources(loadedSources);
    setFavoritesState(loadFavorites());

    const savedActiveId = localStorage.getItem("nova_active_source");
    let initialSource = loadedSources.find((s) => s.id === savedActiveId) || loadedSources[0] || null;

    if (initialSource) {
      handleSelectSource(initialSource);
    }
  }, []);

  // 2. Select / Activate a source
  const handleSelectSource = async (source: NovaSource) => {
    setActiveSource(source);
    localStorage.setItem("nova_active_source", source.id);
    setConnectionStatus({ state: "connecting", message: `Verbinden met ${source.name}...` });
    setSelectedSeriesShow(null);
    setSelectedCategory("all");
    setSearchQuery("");
    setPage(1);

    try {
      await loadMediaForSource(source, view, 1, "all");
      setConnectionStatus({ state: "connected", message: `Verbonden met: ${source.name}` });
    } catch (err: any) {
      console.error("Activation error:", err);
      setConnectionStatus({ state: "error", message: err.message || "Verbinding mislukt" });
    }
  };

  // 3. Load media depending on source type and view
  const loadMediaForSource = async (
    source: NovaSource,
    targetView: "live" | "movies" | "series" | "epg",
    targetPage: number = 1,
    catId: string = "all"
  ) => {
    setLoading(true);
    try {
      if (targetView === "live") {
        let channelList: NovaItem[] = [];

        // Check IndexedDB cache first for fast start
        const cached = await loadSourceItemsFromDB(source.id);
        if (cached && cached.length > 0 && targetPage === 1) {
          channelList = cached;
        } else {
          if (source.type === "stalker") {
            channelList = await stalkerLoadChannels(source);
          } else if (source.type === "xtream") {
            channelList = await xtreamLoadChannels(source);
          } else if (source.type === "m3u") {
            if (source.allItems?.length) {
              channelList = source.allItems;
            } else if (source.url) {
              channelList = await fetchM3U(source.url);
            }
          }
          if (channelList.length > 0) {
            await saveSourceItemsToDB(source.id, channelList);
          }
        }

        setItems(channelList);

        // Build categories
        if (source.type === "stalker" && source.liveCategories?.length) {
          setCategories(source.liveCategories);
        } else {
          const uniqueGroups = Array.from(new Set(channelList.map((c) => c.group || "Algemeen"))).sort();
          setCategories(uniqueGroups.map((g) => ({ id: g, name: g })));
        }
        setHasMore(false);
      } else if (targetView === "movies") {
        if (source.type === "stalker") {
          const res = await stalkerLoadMovies(source, catId, targetPage);
          setCategories(res.categories);
          if (targetPage === 1) {
            setItems(res.items);
          } else {
            setItems((prev) => [...prev, ...res.items]);
          }
          setHasMore(targetPage < res.totalPages);
        } else if (source.type === "xtream") {
          const res = await xtreamLoadMovies(source);
          setCategories(res.categories);
          setItems(res.items);
          setHasMore(false);
        } else if (source.type === "m3u") {
          const m3uMovies = (source.allItems || []).filter(
            (x) =>
              x.mediaType === "movie" ||
              /\.(mp4|mkv|avi|mov)$/i.test(x.url || "") ||
              /(movie|film|vod)/i.test(x.group || "")
          );
          setItems(m3uMovies);
          const groups = Array.from(new Set(m3uMovies.map((m) => m.group || "Films"))).sort();
          setCategories(groups.map((g) => ({ id: g, name: g })));
          setHasMore(false);
        }
      } else if (targetView === "series") {
        if (source.type === "stalker") {
          const res = await stalkerLoadSeries(source, catId, targetPage);
          setCategories(res.categories);
          if (targetPage === 1) {
            setItems(res.items);
          } else {
            setItems((prev) => [...prev, ...res.items]);
          }
          setHasMore(targetPage < res.totalPages);
        } else if (source.type === "xtream") {
          const res = await xtreamLoadSeries(source);
          setCategories(res.categories);
          setItems(res.items);
          setHasMore(false);
        } else {
          setItems([]);
          setCategories([]);
          setHasMore(false);
        }
      } else if (targetView === "epg") {
        // EPG view handles channel schedule directly
        if (source.allItems?.length) {
          setItems(source.allItems);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Switch Media View (Live, Movies, Series, EPG)
  const handleViewChange = async (newView: "live" | "movies" | "series" | "epg") => {
    setView(newView);
    setSelectedSeriesShow(null);
    setSelectedCategory("all");
    setSearchQuery("");
    setPage(1);

    if (activeSource) {
      await loadMediaForSource(activeSource, newView, 1, "all");
    }
  };

  // Add source handler
  const handleAddSource = async (newSource: NovaSource) => {
    const updated = [newSource, ...sources];
    setSources(updated);
    saveStoredSources(updated);
    await handleSelectSource(newSource);
  };

  // Remove source handler
  const handleRemoveSource = async (id: string) => {
    const updated = sources.filter((s) => s.id !== id);
    setSources(updated);
    saveStoredSources(updated);
    await dbDelete(`source:${id}`);

    if (activeSource?.id === id) {
      if (updated.length > 0) {
        await handleSelectSource(updated[0]);
      } else {
        setActiveSource(null);
        setItems([]);
        setCategories([]);
        setConnectionStatus({ state: "idle" });
      }
    }
  };

  // Toggle favorite
  const handleToggleFavorite = (item: NovaItem) => {
    const isFav = favorites.includes(item.id);
    let updated: string[];
    if (isFav) {
      updated = favorites.filter((id) => id !== item.id);
    } else {
      updated = [...favorites, item.id];
    }
    setFavoritesState(updated);
    saveFavorites(updated);
  };

  // Load more pagination
  const handleLoadMore = async () => {
    if (!activeSource || loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await loadMediaForSource(activeSource, view, nextPage, selectedCategory);
  };

  // Filter items by category and search
  const filteredItems = useMemo(() => {
    let result = items;

    if (selectedCategory !== "all") {
      result = result.filter((item) => {
        if (activeSource?.type === "stalker") {
          return item.categoryId === selectedCategory || item.group === selectedCategory;
        }
        return (item.group || "Algemeen") === selectedCategory;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          (item.name || "").toLowerCase().includes(q) ||
          (item.group || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [items, selectedCategory, searchQuery, activeSource?.type]);

  // Click on item
  const handleSelectItem = (item: NovaItem) => {
    if (view === "series" || item.mediaType === "series") {
      // Open series details to read & select episodes
      setSelectedSeriesShow(item);
    } else {
      // Play channel or movie
      setPlayingItem(item);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Top Navigation Header */}
      <Header
        view={view}
        onViewChange={handleViewChange}
        activeSource={activeSource}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={(catId) => {
          setSelectedCategory(catId);
          setPage(1);
          if (activeSource && (view === "movies" || view === "series")) {
            loadMediaForSource(activeSource, view, 1, catId);
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        connectionStatus={connectionStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {/* Welcome / No Connection banner */}
        {!activeSource && (
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-600/20 text-white">
              <Tv size={32} />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-2">
              Welkom bij Nova Hybrid IPTV Player
            </h2>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed max-w-lg mx-auto">
              Verbind met je Stalker / Ministra portal (MAC-adres), Xtream Codes server of M3U playlist om Live TV, Films en Series direct uit te lezen en te bekijken.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg transition cursor-pointer"
              >
                <Plus size={16} />
                <span>Portal of Verbinding Toevoegen</span>
              </button>
            </div>
          </div>
        )}

        {/* View Switcher: Series Detail View vs Main Grid vs EPG */}
        {activeSource && (
          <>
            {selectedSeriesShow ? (
              <SeriesDetailView
                show={selectedSeriesShow}
                source={activeSource}
                onBack={() => setSelectedSeriesShow(null)}
                onPlayEpisode={(ep) => setPlayingItem(ep)}
              />
            ) : view === "epg" ? (
              <EpgView
                source={activeSource}
                channels={items}
                onPlayChannel={(ch) => setPlayingItem(ch)}
              />
            ) : (
              <MediaGrid
                view={view}
                items={filteredItems}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onSelectItem={handleSelectItem}
                loading={loading}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Stalker Series Debug & Info Indicator (Shows Stalker episodes capability) */}
      {activeSource?.type === "stalker" && view === "series" && !selectedSeriesShow && (
        <div className="fixed bottom-4 right-4 z-30 bg-[#111622]/90 backdrop-blur border border-indigo-500/40 rounded-xl px-3.5 py-2 text-[11px] text-gray-300 shadow-xl flex items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Stalker Episodes Engine Actief • Klik op een serie om afleveringen uit te lezen</span>
        </div>
      )}

      {/* Modals & Overlays */}
      <PlayerModal
        item={playingItem}
        source={activeSource}
        onClose={() => setPlayingItem(null)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        sources={sources}
        activeSourceId={activeSource?.id || null}
        onAddSource={handleAddSource}
        onRemoveSource={handleRemoveSource}
        onSelectSource={handleSelectSource}
      />

      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sources={sources}
        activeSourceId={activeSource?.id || null}
        onSelectSource={handleSelectSource}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenDisclaimer={() => setIsDisclaimerOpen(true)}
      />

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <DisclaimerModal isOpen={isDisclaimerOpen} onClose={() => setIsDisclaimerOpen(false)} />
    </div>
  );
}
