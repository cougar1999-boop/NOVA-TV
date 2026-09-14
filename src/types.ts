export interface NovaSource {
  id: string;
  type: "stalker" | "xtream" | "m3u";
  name: string;
  portal?: string;
  mac?: string;
  model?: string;
  server?: string;
  username?: string;
  password?: string;
  url?: string;
  fileName?: string;
  fileType?: string;
  lastRefresh?: number;
  token?: string;
  session_id?: string;
  serial_number?: string;
  liveCategories?: Array<{ id: string; name: string }>;
  allItems?: NovaItem[];
  items?: NovaItem[];
}

export interface NovaItem {
  id: string;
  number?: string;
  name: string;
  group?: string;
  categoryId?: string;
  logo?: string;
  url?: string;
  cmd?: string;
  mediaType?: "live" | "movie" | "series" | "episode";
  seriesId?: string;
  parentSeriesId?: string;
  videoId?: string;
  movieId?: string;
  seasonId?: string;
  seasonNumber?: string | number;
  episodeId?: string;
  episodeNumber?: string | number;
  year?: string | number;
}

export interface NovaCategory {
  id: string;
  name: string;
}

export interface EpgProgram {
  title: string;
  start?: string | number;
  end?: string | number;
  stop?: string | number;
  description?: string;
}

export interface ResumeEntry {
  position: number;
  duration: number;
  title: string;
  mediaType: string;
  updated: number;
}

export interface StalkerEpisodeRaw {
  id?: string | number;
  episode_id?: string | number;
  stream_id?: string | number;
  video_id?: string | number;
  series_id?: string | number;
  season_id?: string | number;
  season_number?: string | number;
  seasonNumber?: string | number;
  season_num?: string | number;
  season?: string | number;
  series_number?: string | number;
  episode_num?: string | number;
  title?: string;
  name?: string;
  cmd?: string;
  url?: string;
  movie_image?: string;
  screenshot_uri?: string;
  cover?: string;
  cover_big?: string;
}
