import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";

export const cortexWeatherRouter = Router();

const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0:  { label: "Clear sky",        icon: "☀️" },
  1:  { label: "Mainly clear",     icon: "🌤️" },
  2:  { label: "Partly cloudy",    icon: "⛅" },
  3:  { label: "Overcast",         icon: "☁️" },
  45: { label: "Foggy",            icon: "🌫️" },
  48: { label: "Icy fog",          icon: "🌫️" },
  51: { label: "Light drizzle",    icon: "🌦️" },
  53: { label: "Drizzle",          icon: "🌦️" },
  55: { label: "Heavy drizzle",    icon: "🌧️" },
  61: { label: "Light rain",       icon: "🌧️" },
  63: { label: "Rain",             icon: "🌧️" },
  65: { label: "Heavy rain",       icon: "🌧️" },
  71: { label: "Light snow",       icon: "🌨️" },
  73: { label: "Snow",             icon: "❄️" },
  75: { label: "Heavy snow",       icon: "❄️" },
  80: { label: "Rain showers",     icon: "🌦️" },
  81: { label: "Rain showers",     icon: "🌧️" },
  82: { label: "Violent showers",  icon: "⛈️" },
  85: { label: "Snow showers",     icon: "🌨️" },
  86: { label: "Heavy snow showers", icon: "❄️" },
  95: { label: "Thunderstorm",     icon: "⛈️" },
  96: { label: "Thunderstorm + hail", icon: "⛈️" },
  99: { label: "Thunderstorm + hail", icon: "⛈️" },
};

function wmo(code: number) {
  return WMO_CODES[code] ?? { label: "Unknown", icon: "🌡️" };
}

// GET /weather?lat=&lon=&units=fahrenheit|celsius
cortexWeatherRouter.get("/", requireAuth, async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  const units = (req.query.units as string) === "celsius" ? "celsius" : "fahrenheit";

  if (isNaN(lat) || isNaN(lon)) {
    throw new HttpError(400, "lat and lon required");
  }

  const tempUnit = units === "fahrenheit" ? "fahrenheit" : "celsius";
  const windUnit = "mph";

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lon.toString());
    url.searchParams.set("current", [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "weather_code",
      "wind_speed_10m",
      "is_day",
    ].join(","));
    url.searchParams.set("daily", [
      "temperature_2m_max",
      "temperature_2m_min",
      "weather_code",
      "precipitation_probability_max",
    ].join(","));
    url.searchParams.set("temperature_unit", tempUnit);
    url.searchParams.set("wind_speed_unit", windUnit);
    url.searchParams.set("forecast_days", "5");
    url.searchParams.set("timezone", "auto");

    const r = await fetch(url.toString());
    if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
    const data = await r.json() as Record<string, unknown>;

    const cur = data.current as Record<string, number>;
    const daily = data.daily as Record<string, unknown[]>;

    const condition = wmo(cur.weather_code);

    // Build 5-day forecast
    const forecast = (daily.time as string[]).map((date, i) => ({
      date,
      high: Math.round((daily.temperature_2m_max as number[])[i]),
      low:  Math.round((daily.temperature_2m_min as number[])[i]),
      precipChance: (daily.precipitation_probability_max as number[])[i] ?? 0,
      ...wmo((daily.weather_code as number[])[i]),
    }));

    sendSuccess(res, {
      current: {
        temp:        Math.round(cur.temperature_2m),
        feelsLike:   Math.round(cur.apparent_temperature),
        humidity:    cur.relative_humidity_2m,
        windSpeed:   Math.round(cur.wind_speed_10m),
        isDay:       cur.is_day === 1,
        ...condition,
      },
      forecast,
      units: tempUnit,
    });
  } catch (e) {
    throw new HttpError(502, `Weather fetch failed: ${e instanceof Error ? e.message : e}`);
  }
});

// GET /weather/geocode?q=City — proxied server-side so client networks with
// DNS filtering (Pi-hole, Tailscale exit nodes) can't break city search.
cortexWeatherRouter.get("/geocode", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q || q.length > 120) {
    throw new HttpError(400, "q required");
  }

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", q);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const r = await fetch(url.toString());
    if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
    const data = await r.json() as {
      results?: Array<{ latitude: number; longitude: number; name: string; country: string }>;
    };
    const hit = data.results?.[0];
    sendSuccess(res, {
      result: hit
        ? { lat: hit.latitude, lon: hit.longitude, name: hit.name, country: hit.country }
        : null,
    });
  } catch (e) {
    throw new HttpError(502, `Geocoding failed: ${e instanceof Error ? e.message : e}`);
  }
});
