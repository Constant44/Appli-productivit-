/**
 * Lever et coucher du soleil à Bordeaux (formules de la NOAA, précision de l'ordre de la minute).
 * Sert à adapter la routine du matin quand il fait encore nuit au réveil.
 */
import { parse, type ISODate } from "./dates";

const BORDEAUX = { lat: 44.84, lon: -0.58 };
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Lever et coucher en minutes UTC depuis minuit. */
export function sunUTC(date: ISODate, lat = BORDEAUX.lat, lon = BORDEAUX.lon) {
  const d = parse(date);
  const n = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 86400000) + 1;
  const g = ((2 * Math.PI) / 365) * (n - 1);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = deg(Math.acos(Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl)));
  return { rise: 720 - 4 * (lon + ha) - eqtime, set: 720 - 4 * (lon - ha) - eqtime };
}

const hhmm = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};

/** Lever et coucher en heure locale de l'appareil (« 08:19 »). */
export function sunTimes(date: ISODate) {
  const { rise, set } = sunUTC(date);
  const offset = new Date(`${date}T12:00:00`).getTimezoneOffset(); // minutes à ajouter à l'heure locale pour obtenir l'UTC
  return { rise: hhmm(rise - offset), set: hhmm(set - offset) };
}
