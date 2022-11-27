import axios from "axios";

const instance = axios.create({
  baseURL: "https://ws.infotbm.com/ws/1.0/",
  timeout: 30_000,
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

interface Line {
  id: `line:${string}`;
  isChartered: boolean;
  isHidden: boolean;
  isSpecial: boolean;
  name: string;
}

interface Route {
  id: `route:${string}`;
  line: Line;
  name: string; // route destination
}

interface StopPoint {
  hasWheelchairBoarding: boolean;
  id: `stop_point:${string}`;
  name: string; // stop point name
  routes: Route[];
}

interface StopAreaDetails {
  city: string;
  id: `stop_area:${string}`;
  latitude: string;
  longitude: string;
  name: string; // stop area name
  stopPoints: StopPoint[];
}

type FullyDescribedStopArea = StopArea & { details: StopAreaDetails };

async function fetchStopAreaDetails(stop: StopArea): Promise<FullyDescribedStopArea | null> {
  try {
    const details = (await instance.get(`network/stoparea-informations/${encodeURI(stop.id)}`))
      .data as StopAreaDetails;
    if (!details) return null;
    details.stopPoints = details.stopPoints.filter((sp, _, arr) =>
      sp.routes.some(
        // if at least one route in this stop point doesn't have a satisfying sibling in another stop point of this stop area
        (r) =>
          !arr.find(
            (sp2) =>
              sp.id != sp2.id &&
              sp2.routes.find((r2) => r2.id === r.id) &&
              sp2.routes.length > sp.routes.length,
          ),
      ),
    );
    details.stopPoints.forEach(
      (sp, _, arr) =>
        (sp.routes = sp.routes.filter(
          (r) =>
            !arr.find((sp2) =>
              sp2.routes.find((r2) => sp.routes.length > sp2.routes.length && r2.id === r.id),
            ),
        )),
    );
    return {
      ...stop,
      details,
    };
  } catch (_) {
    return null;
  }
}

interface Schedules {
  day: number;
  datetimes: {
    [date: string]: {
      datetime: string;
      directionName: string;
      timestamp: number;
      vehicle_journey: `vehicle_journey:${string}`;
    }[];
  };
  destinations: string[];
}

interface StopPointDetails {
  externalCode: string;
  hasWheelchairBoarding: false;
  id: `stop_point:${string}`;
  latitude: string;
  longitude: string;
  name: string;
  route: Omit<Route, "line"> & {
    line: Omit<Line, "isSpecial" | "isHidden" | "isChartered" | "name"> & { type: string };
  };
  schedules: Schedules;
  stopAreaId: `stop_area:${string}`;
}

async function fetchStopPointDetails(route: Route, stop: StopPoint): Promise<StopPointDetails | null> {
  try {
    return (await instance.get(`stop-points-informations/${encodeURI(route.id)}/${encodeURI(stop.id)}`))
      .data as StopPointDetails;
  } catch (_) {
    return null;
  }
}

interface LineDetails {
  code: string;
  color: string;
  externalCode: string;
  id: `line:${string}`;
  impacts: {
    alert: {
      alertUpdates: unknown[];
      cause: number;
      causeName: string;
      description: string;
      id: number;
      title: string;
      type: number;
      typeName: string;
      workingNetwork: boolean;
    };
    transportMode: number;
  }[];
  name: string;
  picto: string; // URL
  pictoCrossed: string;
  textColor: string; // HEX color
  transportMode: number;
}

async function fetchLineDetails(line: Line): Promise<LineDetails[] | null> {
  try {
    return (await instance.get(`alerts/by-transport/${encodeURI(line.id)}`)).data as LineDetails[];
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
  realtime: "0" | "1";
  schedule_id: string;
  trip_id: string;
  updated_at: StringifiedDateTime;
  vehicle_id: string;
  vehicle_lattitude: number;
  vehicle_longitude: number;
  vehicle_position_updated_at: StringifiedDateTime;
  waittime: T extends "RAW" ? StringifiedTime : number;
  waittime_text: string;
  fetched: T extends "TREATED" ? number : undefined;
};

interface RouteRealtime<T extends RRIStats = "TREATED"> {
  destinations: T extends "RAW"
    ? {
        [x: string]: RouteRealtimeInfos<T>[];
      }
    : RouteRealtimeInfos<T>[];
}

async function fetchRouteRealtime(
  stopPointDetails: StopPointDetails,
  lineDetails: LineDetails | { externalCode: string },
  route: Route,
): Promise<RouteRealtime | null> {
  const result = (
    await instance.get(
      `get-realtime-pass/${encodeURI(stopPointDetails.externalCode)}/${encodeURI(
        lineDetails.externalCode,
      )}/${encodeURI(route.id)}`,
    )
  ).data as RouteRealtime<"RAW">;
  return {
    destinations: (Object.keys(result.destinations) as Array<keyof typeof result["destinations"]>).reduce(
      (acc, val) => [
        ...acc,
        ...result.destinations[val].map((rri) => ({
          ...rri,
          waittime:
            rri.waittime
              .match(/\d{2}/g)
              ?.reduce((acc, val, i) => acc + parseInt(val) * 60 ** (2 - i) * 1000, 0) || Infinity,
          fetched: Date.now(),
        })),
      ],
      [] as RouteRealtimeInfos<"TREATED">[],
    ),
  };
}

/**
 * @param ms Une durée en secondes
 * @param includeSec Un booléen indiquant s'il faut inclure les secondes
 * @returns La durée formatée (YY?, MoMo?, DD?, HH?, MiMi?, SS? )
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
  const s = Math.floor(ms / 1000);
  const ss = s > 1 ? "s" : "";

  return `${y > 0 && y < Infinity ? `${y}${short ? "a" : ` an${sy}`} ` : ""}${
    mo > 0 ? `${mo}${short ? "mo" : ` mois`} ` : ""
  }${d > 0 ? `${d}${short ? "j" : ` jour${sd}`} ` : ""}${h > 0 ? `${h}${short ? "h" : ` heure${sh}`} ` : ""}${
    mi > 0 ? `${mi}${short ? ` min${smi}` : ` minute${smi}`} ` : ""
  }${s > 0 && includeSec ? `${s}${short ? "s" : ` seconde${ss}`} ` : ""}`.replace(/ $/g, "");
}

/**
 * @description Checks unicity of a value in an array
 */
function unique<T>(v: T, i: number, arr: T[]): boolean {
  return arr.indexOf(v) === i;
}

interface Settings {
  uncertainty: boolean;
  dates: boolean;
}

const defaultSettings: Settings = {
  uncertainty: false,
  dates: false,
};

function getNewTopZIndex() {
  let max = 0;
  for (const el of document.querySelectorAll("body *")) {
    const zindex = parseInt(window.getComputedStyle(el).zIndex);
    if (zindex > max) max = zindex;
  }
  return max + 1;
}

function dateCompact(date: string | number | Date) {
  if (!(date instanceof Date)) date = new Date(date);
  const deltaD = date.getDate() - new Date().getDate();
  let h: number | string = date.getHours();
  let m: number | string = date.getMinutes();
  let s: number | string = date.getSeconds();

  if (h < 10) h = "0" + h;
  if (m < 10) m = "0" + m;
  if (s < 10) s = "0" + s;
  return `${
    deltaD > 0 ? (deltaD === 1 ? "demain, " : deltaD === 2 ? "après-demain, " : `dans ${deltaD} jours, `) : ""
  }${h}:${m}:${s}`;
}

const preferencesKeys = {
  settings: "settings",
  location: "location",
};

export {
  fetchStops,
  fetchStopAreaDetails,
  fetchStopPointDetails,
  fetchLineDetails,
  fetchRouteRealtime,
  duration,
  unique,
  defaultSettings,
  getNewTopZIndex,
  dateCompact,
  preferencesKeys,
};

export type {
  StopArea,
  StopPoint,
  StopPointDetails,
  LineDetails,
  Route,
  FullyDescribedStopArea,
  RouteRealtime,
  Settings,
};
