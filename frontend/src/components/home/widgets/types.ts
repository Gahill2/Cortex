export interface NowPlaying {
  playing: boolean;
  track?: { name: string; artists: string[]; albumArt?: string };
  device?: { name: string; volumePercent: number };
}

export interface GmailMsg {
  id: string;
  subject: string;
  from: string;
  unread: boolean;
}

export interface WeatherData {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    isDay: boolean;
    label: string;
    icon: string;
  };
  forecast: Array<{
    date: string;
    high: number;
    low: number;
    precipChance: number;
    label: string;
    icon: string;
  }>;
  units: string;
}
