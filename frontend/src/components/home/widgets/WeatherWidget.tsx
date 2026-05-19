import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Cloud, Droplets, MapPin, Wind } from "lucide-react";
import { api } from "../../../api/client";
import { usePreferences } from "../../../context/PreferencesContext";
import type { WeatherLocationPref } from "../../../lib/preferencesTypes";
import type { WeatherData } from "./types";

function prefUnitsToApi(u: "metric" | "imperial"): "fahrenheit" | "celsius" {
  return u === "imperial" ? "fahrenheit" : "celsius";
}

export interface WeatherWidgetProps {
  /** standard | hero | minimal | gradient */
  display?: string;
  layout?: "compact" | "default" | "expanded";
}

export function WeatherWidget({ display = "standard", layout = "default" }: WeatherWidgetProps) {
  const { settings, ready, patch } = usePreferences();
  const compact = layout === "compact";
  const showForecast = display !== "minimal" && !compact;
  const heroLayout = display === "hero" || display === "gradient";
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedLoc = settings.extraJson?.weatherLocation ?? null;
  const units = useMemo(
    () => prefUnitsToApi(settings.weatherUnits ?? "metric"),
    [settings.weatherUnits],
  );
  const [cityInput, setCityInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const persistLocation = useCallback(
    (loc: WeatherLocationPref | null) => {
      patch({
        weatherCity: loc?.name ?? null,
        extraJson: { weatherLocation: loc },
      });
    },
    [patch],
  );

  const fetchWeather = async (lat: number, lon: number, u: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get("/weather", { params: { lat, lon, units: u } });
      setData(r.data?.data ?? null);
    } catch {
      setError("Weather unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (savedLoc) {
      void fetchWeather(savedLoc.lat, savedLoc.lon, units);
      return;
    }
    if (!navigator.geolocation) { setError("Enter a city to get weather"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: WeatherLocationPref = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: "Current location" };
        persistLocation(loc);
        void fetchWeather(loc.lat, loc.lon, units);
      },
      () => setError("Enter a city below to get weather")
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!ready || !savedLoc) return;
    void fetchWeather(savedLoc.lat, savedLoc.lon, units);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, ready, savedLoc?.lat, savedLoc?.lon]);

  const searchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = cityInput.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
      const d = await r.json() as { results?: Array<{ latitude: number; longitude: number; name: string; country: string }> };
      const result = d.results?.[0];
      if (!result) { setSearchError("City not found"); return; }
      const loc: WeatherLocationPref = { lat: result.latitude, lon: result.longitude, name: `${result.name}, ${result.country}` };
      persistLocation(loc);
      setCityInput("");
      void fetchWeather(loc.lat, loc.lon, units);
    } catch {
      setSearchError("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const toggleUnits = () => {
    patch({ weatherUnits: settings.weatherUnits === "imperial" ? "metric" : "imperial" });
  };

  const clearLocation = () => {
    persistLocation(null);
    setData(null);
    setError("Enter a city below to get weather");
  };

  const sym = units === "fahrenheit" ? "°F" : "°C";

  return (
    <div
      className={`widget widget--weather${heroLayout ? " weather-hero-ios" : ""} widget-display--${display}`}
    >
      <div className="widget-label-row">
        <span className="widget-label widget-label--icon">
          <Cloud size={16} strokeWidth={1.75} aria-hidden />
          <span>Weather</span>
        </span>
        {savedLoc && (
          <button
            type="button"
            className="weather-location-name weather-location-name--btn"
            onClick={clearLocation}
            title="Change location"
          >
            <MapPin size={12} strokeWidth={1.75} aria-hidden />
            {savedLoc.name}
          </button>
        )}
        <button type="button" className="widget-units-btn" onClick={toggleUnits}>{sym}</button>
      </div>

      {loading && <p className="widget-empty">Loading…</p>}

      {!loading && !data && (
        <form className="weather-city-form" onSubmit={(e) => void searchCity(e)}>
          {error && <p className="widget-empty" style={{ marginBottom: 8 }}>{error}</p>}
          <div className="weather-city-row">
            <input
              className="weather-city-input"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Enter city name…"
              autoFocus
            />
            <button type="submit" className="btn-primary btn-sm" disabled={searching || !cityInput.trim()}>
              {searching ? "…" : "Go"}
            </button>
          </div>
          {searchError && <p className="weather-search-error">{searchError}</p>}
        </form>
      )}

      {data && !loading && (
        <>
          <div className="weather-current" style={{ flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span className="weather-icon-hero">{data.current.icon}</span>
            <span className="weather-temp-hero">{data.current.temp}{sym}</span>
            <span className="weather-label" style={{ textAlign: "center", marginBottom: 2 }}>{data.current.label}</span>
            <div className="weather-pills-row">
              <span className="weather-pill">Feels {data.current.feelsLike}{sym}</span>
              <span className="weather-pill weather-pill--icon">
                <Droplets size={12} strokeWidth={1.75} aria-hidden />
                {data.current.humidity}%
              </span>
              <span className="weather-pill weather-pill--icon">
                <Wind size={12} strokeWidth={1.75} aria-hidden />
                {data.current.windSpeed} {units === "fahrenheit" ? "mph" : "km/h"}
              </span>
            </div>
          </div>
          {showForecast ? (
          <div className="weather-forecast">
            {data.forecast.slice(0, compact ? 3 : 5).map((day) => {
              const label = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
              return (
                <div key={day.date} className="weather-day-stacked">
                  <span className="weather-day-name">{label}</span>
                  <span className="weather-day-icon">{day.icon}</span>
                  <span className="weather-day-temps">
                    <span className="weather-day-high">{day.high}{sym}</span>{" "}
                    <span className="weather-day-low">{day.low}{sym}</span>
                  </span>
                </div>
              );
            })}
          </div>
          ) : null}
          {!compact ? (
          <form className="weather-city-form weather-city-form--inline" onSubmit={(e) => void searchCity(e)}>
            <div className="weather-city-row">
              <input className="weather-city-input" value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="Change city…" />
              <button type="submit" className="btn-ghost btn-sm" disabled={searching || !cityInput.trim()} aria-label="Search city">
                {searching ? "…" : <ArrowRight size={14} strokeWidth={1.75} aria-hidden />}
              </button>
            </div>
            {searchError && <p className="weather-search-error">{searchError}</p>}
          </form>
          ) : null}
        </>
      )}
    </div>
  );
}
