import axios from "axios";
import type { FetchStatus } from "..";

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

type StopPointId = `stop_point:${string}`;

interface StopPoint {
  hasWheelchairBoarding: boolean;
  id: StopPointId;
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

type VehicleJourneyId = `vehicle_journey:${string}`;

interface Schedules {
  day: number;
  datetimes: {
    [date: string]: {
      datetime: string;
      directionName: string;
      timestamp: number; // /!\ in seconds
      vehicle_journey: VehicleJourneyId;
    }[];
  };
  destinations: string[];
}

interface StopPointDetails {
  externalCode: string;
  hasWheelchairBoarding: false;
  id: StopPointId;
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
  departure_delay: T extends "TREATED" ? number : undefined;
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
  let waittime = Infinity;
  return {
    destinations: (Object.keys(result.destinations) as Array<keyof (typeof result)["destinations"]>).reduce(
      (acc, val) => [
        ...acc,
        ...result.destinations[val].map((rri) => ({
          ...rri,
          waittime: (waittime =
            rri.waittime
              .match(/\d{2}/g)
              ?.reduce((acc, val, i) => acc + parseInt(val) * 60 ** (2 - i) * 1000, 0) || Infinity),
          departure_delay: Date.parse(rri.departure_theorique.replace(" ", "T")) - waittime - Date.now(),
          fetched: Date.now(),
        })),
      ],
      [] as RouteRealtimeInfos<"TREATED">[],
    ),
  };
}

interface VehicleJourneySchedule<T extends RRIStats> {
  arrival_time: string;
  departure_time: T extends "RAW" ? string : number;
  drop_off_allowed: boolean;
  headsign: string;
  pickup_allowed: boolean;
  skipped_stop: boolean;
  stop_point: {
    address: {
      house_number: number;
      id: string;
      label: string;
      name: string;
      coord: { lon: string; lat: string };
    };
    codes: { type: string; value: number }[];
    coord: { lon: string; lat: string };
    equipments: [];
    fare_zone: { name: string };
    id: StopPointId;
    label: string;
    links: [];
    name: string;
  };
  utc_arrival_time: string;
  utc_departure_time: string;
}

async function fetchVehicleJourney(
  referenceSchedule: Schedules["datetimes"][string][number] & { stopPointId: StopPointId },
): Promise<VehicleJourneySchedule<"TREATED">[] | null> {
  try {
    const vehicleJourney = (await instance.get(`get-vehicle-schedule/${referenceSchedule.vehicle_journey}`))
      .data as VehicleJourneySchedule<"RAW">[];
    const refScheduleInJourney = vehicleJourney.find(
      (schedule) => schedule.stop_point.id === referenceSchedule.stopPointId,
    );
    if (refScheduleInJourney) vehicleJourney.splice(0, vehicleJourney.indexOf(refScheduleInJourney));

    const referenceScheduleDate = new Date(referenceSchedule.timestamp * 1_000);
    const referenceScheduleDateHMS =
      ((referenceScheduleDate.getHours() * 60 + referenceScheduleDate.getMinutes()) * 60 +
        referenceScheduleDate.getSeconds()) *
      1_000;

    return vehicleJourney.map((schedule) => {
      const scheduleHMSTime =
        schedule.departure_time
          .match(/\d{2}/g)
          ?.reduce((acc, v, i) => acc + 1_000 * parseInt(v) * 60 ** (2 - i), 0) ?? NaN;

      let HMSdiff = scheduleHMSTime - referenceScheduleDateHMS;
      if (HMSdiff < 0) {
        // Next day
        HMSdiff += 24 * 60 * 60 * 1_000;
      }

      return {
        ...schedule,
        departure_time: new Date(referenceScheduleDate.getTime() + HMSdiff).getTime(),
      };
    });
  } catch (_) {
    return null;
  }
}

type OperatingRoute = Route & { stopPointDetails: StopPointDetails } & {
  lineDetails: LineDetails | { externalCode: string };
} & { fetch: FetchStatus };

export {
  fetchStops,
  fetchStopAreaDetails,
  fetchStopPointDetails,
  fetchLineDetails,
  fetchRouteRealtime,
  fetchVehicleJourney,
};

export type {
  StopArea,
  StopPoint,
  StopPointDetails,
  LineDetails,
  Route,
  FullyDescribedStopArea,
  RouteRealtime,
  RouteRealtimeInfos,
  Schedules,
  VehicleJourneySchedule,
  OperatingRoute,
};