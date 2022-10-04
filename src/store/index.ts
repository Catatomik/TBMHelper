import axios from "axios";

const instance = axios.create({
  baseURL: "https://ws.infotbm.com/ws/1.0/",
  timeout: 5_000,
});

interface StopArea {
  id: `stop_area:${string}`;
  name: string; // stop area name
  type: "line" | "stop_area";
  mode: string;
  url: string;
}

async function fetchStops(stop: string): Promise<StopArea[]> {
  try {
    const results: StopArea[] = (await instance.get(`get-schedule/${encodeURI(stop)}`)).data;

    return results.filter((r) => r.type === "stop_area");
  } catch (_) {
    return [];
  }
}

interface Route {
  id: `route:${string}`;
  line: {
    id: `line:${string}`;
    isChartered: boolean;
    isHidden: boolean;
    isSpecial: boolean;
    name: string; // line name
  };
  name: string; // route destination
}

interface StopPoint {
  hasWheelchairBoarding: boolean;
  id: `stop_point:${string}`;
  name: string; // stop point name
  routes: Route[];
}

interface StopDetails {
  city: string;
  id: `stop_area:${string}`;
  latitude: string;
  longitude: string;
  name: string; // stop area name
  stopPoints: StopPoint[];
}

type FullyDescribedStop = StopArea & { details: StopDetails };

async function fetchStopDetails(stop: StopArea): Promise<FullyDescribedStop | null> {
  try {
    return {
      ...stop,
      details: (await instance.get(`network/stoparea-informations/${encodeURI(stop.id)}`))
        .data as StopDetails,
    };
  } catch (_) {
    return null;
  }
}

type StringifiedTime = `${number}${number}:${number}${number}:${number}${number}`;
type StringifiedDateTime =
  `${number}${number}${number}${number}-${number}${number}-${number}${number} ${StringifiedTime}`;

type RRIStats = "RAW" | "TREATED";
type RouteRealtimeInfos<T> = {
  arrival: StringifiedDateTime;
  arrival_commande: StringifiedDateTime;
  arrival_theorique: StringifiedDateTime;
  comment: string;
  departure: StringifiedDateTime;
  departure_commande: StringifiedDateTime;
  departure_theorique: StringifiedDateTime;
  destination_id: `${number}${number}${number}${number}`;
  destination_name: string;
  origin: string;
  realtime: "1";
  schedule_id: string;
  trip_id: string;
  updated_at: StringifiedDateTime;
  vehicle_id: string;
  vehicle_lattitude: number;
  vehicle_longitude: number;
  vehicle_position_updated_at: StringifiedDateTime;
  waittime: T extends "RAW" ? StringifiedTime : number;
  waittime_text: string;
};

interface RouteRealtime<T extends RRIStats = "TREATED"> {
  destinations: T extends "RAW"
    ? {
        [x: string]: RouteRealtimeInfos<T>[];
      }
    : RouteRealtimeInfos<T>[];
}

async function fetchRouteRealtime(stopPointId: string, route: Route): Promise<RouteRealtime | null> {
  const vehicleCode = route.line.id.includes("TBC")
    ? route.line.id.match(/(?<=TBC:)\d+/)![0]
    : route.line.id.includes("TBT")
    ? route.line.name.match(/[A-Z]$/)![0]
    : null;
  if (!vehicleCode) return null;
  try {
    const result = (
      await instance.get(`get-realtime-pass/${stopPointId}/${vehicleCode}/${encodeURI(route.id)}`)
    ).data as RouteRealtime<"RAW">;
    return {
      destinations: (Object.keys(result.destinations) as Array<keyof typeof result["destinations"]>).reduce(
        (acc, val) => [
          ...acc,
          ...result.destinations[val].map((rri) => ({
            ...rri,
            waittime: rri.waittime
              .match(/\d{2}/g)!
              .reduce((acc, val, i) => acc + parseInt(val) * 60 ** (2 - i) * 1000, 0),
          })),
        ],
        [] as RouteRealtimeInfos<"TREATED">[],
      ),
    };
  } catch (_) {
    return null;
  }
}

/**
 * @param {Number} ms Une durée en secondes
 * @param {Boolean} includeSec Un booléen indiquant s'il faut inclure les secondes
 * @returns {String} La durée formatée (YY?, MoMo?, DD?, HH?, MiMi?, SS? )
 */
function duration(ms: number, includeSec = true, short = false): string {
  ms = Math.sqrt(ms ** 2); //ensure positive value

  const y = Math.floor(ms / 31556952000);
  ms -= y * 31556952000;
  const sy = y > 1 ? "s" : "";
  const mo = Math.floor(ms / 2629746000);
  ms -= mo * 2629746000;
  const d = Math.floor(ms / (3600000 * 24));
  ms -= d * 3600000 * 24;
  const sd = d > 1 ? "s" : "";
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const sh = h > 1 ? "s" : "";
  const mi = Math.floor(ms / 60000);
  ms -= mi * 60000;
  const smi = mi > 1 ? "s" : "";
  const s = Math.round(ms / 1000);
  const ss = s > 1 ? "s" : "";

  return `${y > 0 && y < Infinity ? `${y}${short ? "a" : ` an${sy}`} ` : ""}${
    mo > 0 ? `${mo}${short ? "mo" : ` mois`} ` : ""
  }${d > 0 ? `${d}${short ? "j" : ` jour${sd}`} ` : ""}${h > 0 ? `${h}${short ? "h" : ` heure${sh}`} ` : ""}${
    mi > 0 ? `${mi}${short ? ` min${smi}` : ` minute${smi}`} ` : ""
  }${s > 0 && includeSec ? `${s}${short ? "s" : ` seconde${ss}`} ` : ""}`.replace(/ $/g, "");
}

export { fetchStops, fetchStopDetails, fetchRouteRealtime, duration };

export type {
  StopArea,
  Route,
  StopPoint,
  StopDetails,
  FullyDescribedStop,
  RouteRealtimeInfos,
  RouteRealtime,
};
