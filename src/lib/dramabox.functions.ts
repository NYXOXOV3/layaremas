export const SHORT_DRAMA_PROVIDER_IDS = [
  "shortmax",
  "blinkdrama",
  "vibeshort",
  "storyreel",
  "dramarush",
  "dramawave",
  "dramabox",
  "netshort",
  "flextv",
  "flickreels",
  "reelshort",
  "stardusttv",
  "dramabite",
  "starshort",
  "microdrama",
  "melolo",
  "shortwave",
  "cubetv",
  "pinedrama",
  "raptdrama",
  "goodshort",
  "joyreels",
  "vigloo",
] as const;

export type ShortDramaProvider = (typeof SHORT_DRAMA_PROVIDER_IDS)[number];

export const SHORT_DRAMA_PROVIDER_NAMES: Record<ShortDramaProvider, string> = {
  shortmax: "ShortMax",
  blinkdrama: "BlinkDrama",
  vibeshort: "VibeShort",
  storyreel: "StoryReel",
  dramarush: "DramaRush",
  dramawave: "DramaWave",
  dramabox: "DramaBox",
  netshort: "NetShort",
  flextv: "FlexTV",
  flickreels: "FlickReels",
  reelshort: "ReelShort",
  stardusttv: "StardustTV",
  dramabite: "DramaBite",
  starshort: "StarShort",
  microdrama: "MicroDrama",
  melolo: "Melolo",
  shortwave: "ShortWave",
  cubetv: "CubeTV",
  pinedrama: "PineDrama",
  raptdrama: "RaptDrama",
  goodshort: "GoodShort",
  joyreels: "JoyReels",
  vigloo: "Vigloo",
};

export interface DramaBoxItem {
  id: string;
  provider: ShortDramaProvider;
  title: string;
  overview: string;
  posterUrl: string | null;
  episodeCount: number;
  tags: string[];
  status: string;
  playCount: number | string;
}

export interface DramaBoxEpisode {
  id: string;
  number: number;
  title: string;
  coverUrl: string | null;
  duration: number;
  locked: boolean;
  streamUrl: string | null;
}

export interface DramaBoxDetails extends DramaBoxItem {
  episodes: DramaBoxEpisode[];
  recommends: DramaBoxItem[];
}
