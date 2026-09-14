import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { X, Maximize, AlertCircle, Play, Copy, Check, ExternalLink } from "lucide-react";
import { NovaSource, NovaItem } from "../types";
import { buildProxiedStreamUrl, stalkerResolvePlayUrl, getSafeImageUrl } from "../services/novaApi";
import { loadResumeStore, saveResumeStore } from "../services/novaStorage";

interface PlayerModalProps {
  item: NovaItem | null;
  source: NovaSource | null;
  onClose: () => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({ item, source, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<string>("Stream voorbereiden...");
  const [error, setError] = useState<string | null>(null);
  const [needUserPlay, setNeedUserPlay] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [resumePrompt, setResumePrompt] = useState<{ position: number } | null>(null);
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string>("");

  const itemKey = item && source ? `${source.id}::${item.mediaType}::${item.id}` : "";

  // Check for saved resume position
  useEffect(() => {
    if (!item || !source) return;
    if (item.mediaType === "movie" || item.mediaType === "episode") {
      const store = loadResumeStore();
      const saved = store[itemKey];
      if (saved && saved.position > 10) {
        setResumePrompt({ position: saved.position });
      }
    }
  }, [itemKey]);

  // Setup stream resolution and playback
  useEffect(() => {
    if (!item || !source) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setNeedUserPlay(false);
    setStatusMsg("Verbinden met portaal...");

    function cleanupCurrentPlayer() {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
      if (mpegtsRef.current) {
        try {
          mpegtsRef.current.pause();
          mpegtsRef.current.unload();
          mpegtsRef.current.detachMediaElement();
          mpegtsRef.current.destroy();
        } catch {}
        mpegtsRef.current = null;
      }
    }

    async function initStream() {
      try {
        let streamUrl = item?.url || "";

        // If Stalker, resolve fresh playable stream URL via create_link
        if (source?.type === "stalker") {
          setStatusMsg("Stalker stream URL ophalen (create_link)...");
          streamUrl = await stalkerResolvePlayUrl(source, item!);
        }

        if (!isMounted) return;

        if (!streamUrl) {
          throw new Error("Geen afspeelbare URL ontvangen van het portaal.");
        }

        // Android Native Player hybrid check
        const nativeBridge = (window as any).NovaNativePlayer;
        if (
          nativeBridge &&
          typeof nativeBridge.playStalker === "function" &&
          source?.type === "stalker"
        ) {
          nativeBridge.playStalker(
            streamUrl,
            JSON.stringify({
              title: item?.name || "Video",
              portal: source.portal || "",
              channel_id: item?.id ? String(item.id) : "",
              episode_id: item?.episodeId || item?.id || "",
              mac: source.mac || "",
              model: source.model || "MAG254",
              session_id: source.session_id || source.token || "",
              media_type: item?.mediaType || "live",
              user_agent:
                "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250",
            })
          );
          onClose();
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        cleanupCurrentPlayer();

        const isHls = /\.m3u8($|\?)/i.test(streamUrl) || streamUrl.includes("extension=m3u8");
        const isMkv = /\.mkv($|\?)/i.test(streamUrl) || (streamUrl.includes("stream=") && streamUrl.includes(".mkv"));
        const isVod = item?.mediaType === "movie" || item?.mediaType === "episode";
        const isTs =
          /\.ts($|\?)/i.test(streamUrl) ||
          streamUrl.includes("extension=ts") ||
          streamUrl.includes("/play/live.php") ||
          (source.type === "stalker" && item?.mediaType === "live" && !isHls);

        // Helper to mark player as playing/ready
        const onPlaybackStarted = () => {
          if (isMounted) {
            setLoading(false);
            setNeedUserPlay(false);
          }
        };

        video.onplaying = onPlaybackStarted;
        video.onloadeddata = onPlaybackStarted;
        video.oncanplay = onPlaybackStarted;
        video.ontimeupdate = () => {
          if (video.currentTime > 0) onPlaybackStarted();
        };

        // Robust Remux / Transcode Playback using mpegts MSE player
        const startRemuxPlayback = (resumeSec = 0) => {
          if (!isMounted) return;
          cleanupCurrentPlayer();
          setStatusMsg("Video stream initialiseren...");
          const remuxUrl = buildProxiedStreamUrl(streamUrl, source, item, resumeSec, true);
          setCurrentStreamUrl(remuxUrl);

          if (mpegts.isSupported()) {
            try {
              const player = mpegts.createPlayer(
                {
                  type: "mpegts",
                  isLive: false,
                  url: remuxUrl,
                  hasAudio: true,
                  hasVideo: true,
                },
                {
                  enableWorker: false,
                  lazyLoad: false,
                  liveBufferLatencyChasing: false,
                  autoCleanupSourceBuffer: true,
                }
              );

              mpegtsRef.current = player;
              player.attachMediaElement(video);
              player.load();
              const playPromise = player.play();
              if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch((err: any) => {
                  if (err.name === "NotAllowedError") setNeedUserPlay(true);
                });
              }

              player.on(mpegts.Events.MEDIA_INFO, () => {
                onPlaybackStarted();
              });

              player.on(mpegts.Events.ERROR, (errType, errDetail) => {
                console.warn("mpegts playback error in remux:", errType, errDetail);
              });
            } catch (err) {
              console.warn("mpegts failed to initialize in remux, falling back to direct video:", err);
              video.src = remuxUrl;
              video.load();
              video.play().catch((playErr: any) => {
                if (playErr.name === "NotAllowedError") setNeedUserPlay(true);
              });
            }
          } else {
            video.src = remuxUrl;
            video.load();
            video.play().catch((err: any) => {
              if (err.name === "NotAllowedError") setNeedUserPlay(true);
            });
          }
        };
        if (isHls) {
          setStatusMsg("HLS stream initialiseren...");
          const proxiedHls = buildProxiedStreamUrl(streamUrl, source, item, 0, false);
          setCurrentStreamUrl(proxiedHls);

          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              fragLoadingTimeOut: 20000,
              manifestLoadingTimeOut: 20000,
            });
            hlsRef.current = hls;
            hls.loadSource(proxiedHls);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (isMounted) {
                setLoading(false);
                video.play().catch((err) => {
                  if (err.name === "NotAllowedError") setNeedUserPlay(true);
                });
              }
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
              if (data.fatal) {
                console.warn("HLS fatal error, trying remux:", data);
                cleanupCurrentPlayer();
                startRemuxPlayback();
              }
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = proxiedHls;
            video.play().catch((err) => {
              if (err.name === "NotAllowedError") setNeedUserPlay(true);
            });
          } else {
            startRemuxPlayback();
          }
        }
        // Strategy 2: Movies / VOD / MKV files
        // Browsers cannot natively play Matroska (.mkv) in HTML5 <video>.
        // Route through fMP4 remuxer for instant playback in all browsers!
        else if (isVod || isMkv) {
          setStatusMsg("Video laden en synchroniseren...");
          startRemuxPlayback();
        }
        // Strategy 3: MPEG-TS Live TV Streams
        else if (isTs) {
          setStatusMsg("Live TV stream initialiseren...");
          const proxiedLive = buildProxiedStreamUrl(streamUrl, source, item, 0, false);
          setCurrentStreamUrl(proxiedLive);

          if (mpegts.isSupported()) {
            try {
              const player = mpegts.createPlayer(
                {
                  type: "mpegts",
                  isLive: true,
                  url: proxiedLive,
                },
                {
                  enableWorker: false, // Run in main thread to prevent sandboxed iframe worker blocks
                  lazyLoad: false,
                  liveBufferLatencyChasing: true,
                  autoCleanupSourceBuffer: true,
                }
              );

              mpegtsRef.current = player;
              player.attachMediaElement(video);
              player.load();
              const playPromise = player.play();
              if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch((err: any) => {
                  if (err.name === "NotAllowedError") setNeedUserPlay(true);
                });
              }

              player.on(mpegts.Events.MEDIA_INFO, () => {
                onPlaybackStarted();
              });

              player.on(mpegts.Events.ERROR, (errType, errDetail) => {
                console.warn("mpegts playback warning/error, switching to remux:", errType, errDetail);
                cleanupCurrentPlayer();
                startRemuxPlayback();
              });
            } catch (tsErr) {
              console.warn("mpegts.createPlayer exception, using remux:", tsErr);
              startRemuxPlayback();
            }
          } else {
            startRemuxPlayback();
          }
        }
        // Strategy 4: Standard Direct Video (MP4 / WebM)
        else {
          setStatusMsg("Directe videostream laden...");
          const proxiedDirect = buildProxiedStreamUrl(streamUrl, source, item, 0, false);
          setCurrentStreamUrl(proxiedDirect);
          video.src = proxiedDirect;
          video.load();
          video.play().catch((err) => {
            if (err.name === "NotAllowedError") setNeedUserPlay(true);
          });
        }

        // Global video error handler: if stream fails, try remux once before raising error
        video.onerror = () => {
          if (!isMounted) return;
          if (!video.src.includes("remux.mp4")) {
            console.warn("Direct stream error, switching to remux fallback...");
            cleanupCurrentPlayer();
            startRemuxPlayback();
          } else {
            setLoading(false);
            setError("Videoweergave mislukt. Controleer portaalverbinding of streamstatus.");
          }
        };

        // Safety watchdog: after 10s of spinner with no frames, offer manual play or remux
        const watchdogTimer = setTimeout(() => {
          if (isMounted && loading && !error) {
            if (video.paused) {
              setNeedUserPlay(true);
              setLoading(false);
            } else if (!video.src.includes("remux.mp4")) {
              cleanupCurrentPlayer();
              startRemuxPlayback();
            }
          }
        }, 10000);

        return () => clearTimeout(watchdogTimer);
      } catch (err: any) {
        if (isMounted) {
          console.error("Playback init error:", err);
          setError(err.message || "Afspeelfout opgetreden");
          setLoading(false);
        }
      }
    }

    initStream();

    return () => {
      isMounted = false;
      cleanupCurrentPlayer();
      if (videoRef.current) {
        videoRef.current.onplaying = null;
        videoRef.current.onloadeddata = null;
        videoRef.current.oncanplay = null;
        videoRef.current.ontimeupdate = null;
        videoRef.current.onerror = null;
      }
    };
  }, [item?.id, source?.id]);

  // Periodic resume checkpoint save
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !item || !source) return;
    if (item.mediaType !== "movie" && item.mediaType !== "episode") return;

    const interval = setInterval(() => {
      if (!video || video.paused || video.ended) return;
      const pos = Math.floor(video.currentTime);
      if (pos > 10) {
        const store = loadResumeStore();
        store[itemKey] = {
          position: pos,
          duration: Math.floor(video.duration || 0),
          title: item.name || "Video",
          mediaType: item.mediaType || "episode",
          updated: Date.now(),
        };
        saveResumeStore(store);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [itemKey]);

  const handleResumeChoice = (resume: boolean) => {
    const video = videoRef.current;
    if (video && resumePrompt) {
      if (resume) {
        const pos = resumePrompt.position;
        if (currentStreamUrl && currentStreamUrl.includes("remux.mp4")) {
          try {
            const urlObj = new URL(currentStreamUrl, window.location.origin);
            urlObj.searchParams.set("ss", String(Math.floor(pos)));
            urlObj.searchParams.set("resume", String(Math.floor(pos)));
            const newUrl = urlObj.pathname + urlObj.search;
            setCurrentStreamUrl(newUrl);
            video.src = newUrl;
            video.load();
            video.play().catch(() => setNeedUserPlay(true));
          } catch {
            video.currentTime = pos;
          }
        } else {
          video.currentTime = pos;
        }
      } else {
        const store = loadResumeStore();
        delete store[itemKey];
        saveResumeStore(store);
      }
    }
    setResumePrompt(null);
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (video) {
      if (video.requestFullscreen) video.requestFullscreen();
    }
  };

  const handleManualPlay = () => {
    const video = videoRef.current;
    setNeedUserPlay(false);
    setLoading(false);
    if (video) {
      video.play().catch((e) => {
        console.warn("Manual play error:", e);
      });
    }
  };

  const handleCopyStreamUrl = () => {
    if (!currentStreamUrl) return;
    const fullUrl = window.location.origin + currentStreamUrl;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!item || !source) return null;

  return (
    <div
      id="player"
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-2 sm:p-4 backdrop-blur-md"
    >
      {/* Top Controls Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between py-2.5 px-4 bg-[#111622] rounded-t-2xl border-t border-x border-gray-800 text-white shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="min-w-0">
            <h3 id="pname" className="text-sm sm:text-base font-bold text-white truncate leading-snug">
              {item.name}
            </h3>
            <p id="pmsg" className="text-xs text-gray-400 truncate">
              {statusMsg}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentStreamUrl && (
            <button
              type="button"
              onClick={handleCopyStreamUrl}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs transition cursor-pointer"
              title="Kopieer stream URL voor VLC / externe speler"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? "Gekopieerd!" : "Stream URL"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleFullscreen}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition cursor-pointer"
            title="Volledig scherm"
          >
            <Maximize size={16} />
          </button>
          <button
            type="button"
            id="close"
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-800 hover:bg-rose-600 text-gray-300 hover:text-white transition cursor-pointer"
            title="Sluiten"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="w-full max-w-5xl aspect-video bg-black rounded-b-2xl overflow-hidden relative border border-gray-800 flex items-center justify-center">
        <video
          id="video"
          ref={videoRef}
          controls
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />

        {/* Play Button Overlay (when browser autoplay policy blocks unmuted audio) */}
        {needUserPlay && !error && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-20">
            <button
              type="button"
              onClick={handleManualPlay}
              className="flex items-center gap-2.5 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-2xl transition-transform hover:scale-105 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Klik om af te spelen</span>
            </button>
            <p className="text-xs text-gray-300 mt-2">Browser vereist klik om audio te starten</p>
          </div>
        )}

        {/* Loading Spinner Overlay */}
        {loading && !error && !needUserPlay && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-4 pointer-events-none z-10">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3" />
            <p className="text-sm font-bold text-white">{statusMsg}</p>
            <p className="text-xs text-gray-400 mt-1 font-mono">{source.name}</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto z-30">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
            <h4 className="text-base font-bold text-white mb-1">Afspelen mislukt</h4>
            <p className="text-xs text-rose-200 mb-4">{error}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  if (videoRef.current) {
                    const remuxUrl = buildProxiedStreamUrl(currentStreamUrl, source, item, 0, true);
                    videoRef.current.src = remuxUrl;
                    videoRef.current.play().catch(() => setNeedUserPlay(true));
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Opnieuw proberen
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Sluiten
              </button>
            </div>
          </div>
        )}

        {/* Resume Dialog Prompt */}
        {resumePrompt && (
          <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-4 z-20">
            <div className="bg-[#111622] border border-gray-700 rounded-2xl p-6 max-w-sm text-center shadow-2xl">
              <h4 className="text-base font-bold text-white mb-1">Afspelen hervatten?</h4>
              <p className="text-xs text-gray-300 mb-4">
                Je was eerder gebleven op{" "}
                <span className="font-bold text-indigo-400">
                  {Math.floor(resumePrompt.position / 60)}:
                  {String(resumePrompt.position % 60).padStart(2, "0")}
                </span>
                .
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => handleResumeChoice(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Hervatten
                </button>
                <button
                  type="button"
                  onClick={() => handleResumeChoice(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Vanaf begin
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
