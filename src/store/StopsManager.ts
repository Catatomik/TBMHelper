import { ref } from "vue";
import {
  fetchStopAreaDetails,
  fetchStops,
  type FullyDescribedStopArea,
  type StopArea,
  type StopPoint,
} from "./TBM";
import router from "@/router";
import { type LocationQuery, type RouteLocationNormalized } from "vue-router";
import { unique } from ".";

const selectedStops = ref<FullyDescribedStopArea[]>([]);
const excludedStopPoints = ref<[StopArea["id"], StopPoint["id"]][]>([]);

const stops = ref<StopArea[]>([]);

let query: LocationQuery = {};
let queryInternallyUpdated = false;

function provideQuery(q: LocationQuery) {
  query = { ...q };
}

async function queryUpdated(to: RouteLocationNormalized) {
  if (queryInternallyUpdated) {
    queryInternallyUpdated = false;
    return;
  }
  query = { ...to.query };

  for (const k of Object.keys(to.query)
    .filter((k) => !isNaN(parseInt(k)))
    .sort((a, b) => parseInt(a) - parseInt(b))) {
    const providenStop = to.query[k] as string;

    if (selectedStops.value.find((s) => s.name === providenStop)) continue;
    const found = (await fetchStops(providenStop)).find((s) => s.name === providenStop);
    if (!found) {
      delete query[k];
      queryInternallyUpdated = true;
      router.push({ query });
      continue;
    }
    const fullyDescribedStop = await fetchStopAreaDetails(found);
    if (!fullyDescribedStop) {
      delete query[k];
      queryInternallyUpdated = true;
      router.push({ query });
      continue;
    }
    selectedStops.value = [...selectedStops.value, fullyDescribedStop];
  }

  const providenStops = Object.keys(query).map((k) => query[k]);
  selectedStops.value = selectedStops.value.filter((s) => providenStops.includes(s.name));

  excludedStopPoints.value = deserializeExcludedStopPoints(
    typeof query["eSP"] === "string" ? query["eSP"] : "",
  );
}

function deserializeExcludedStopPoints(serializedExcludedStopPoints: string) {
  const stopAreas = serializedExcludedStopPoints.split(",");
  if (!stopAreas.length) return [];

  const excludedStopPoints = [] as [StopArea["id"], StopPoint["id"]][];

  for (const stopAreaString of stopAreas) {
    const stopAreaNumber = stopAreaString.match(/^\d+/)?.[0];
    if (stopAreaNumber === undefined) continue;

    const stopAreaName = query[stopAreaNumber];
    if (!stopAreaName) continue;

    const stopArea = selectedStops.value.find((s) => s.name === stopAreaName);
    if (!stopArea) continue;

    const stopPoints = stopAreaString.split("-");

    for (let i = 1; i < stopPoints.length; i++) {
      const stopPoint = stopArea.details.stopPoints.find((s) => s.id.endsWith(stopPoints[i]));
      if (!stopPoint) continue;

      excludedStopPoints.push([stopArea.id, stopPoint.id]);
    }
  }

  return excludedStopPoints;
}

function serializeExcludedStopPoints(excludedStopPoints: [StopArea["id"], StopPoint["id"]][]) {
  const partialExcludedStopPoints = [] as string[];

  for (const stopAreaId of excludedStopPoints.map(([stopArea]) => stopArea).filter(unique)) {
    const stopArea = selectedStops.value.find((s) => s.id === stopAreaId);
    if (!stopArea) continue;

    const stopAreaNumber = Object.keys(query).find((k) => query[k] === stopArea.name);
    if (stopAreaNumber === undefined) continue;

    partialExcludedStopPoints.push(
      `${stopAreaNumber}-${excludedStopPoints
        .filter(([stopArea]) => stopArea === stopAreaId)
        .map((esp) => esp[1].substring("stop_point:".length))
        .join("-")}`,
    );
  }

  return partialExcludedStopPoints.join(",");
}

async function addStop(stop: string) {
  const alreadySelected = selectedStops.value.find((s) => s.name === stop);
  if (alreadySelected) {
    if (excludedStopPoints.value.find(([sp]) => sp === alreadySelected.id)) {
      excludedStopPoints.value = excludedStopPoints.value.filter(([sp]) => sp != alreadySelected.id);
      query["eSP"] = serializeExcludedStopPoints(excludedStopPoints.value);
      if (!query["eSP"].length) delete query["eSP"];
      queryInternallyUpdated = true;
      router.push({ query });
      return 1;
    } else return -1; //display error
  }
  const found = stops.value.find((s) => s.name === stop);
  if (!found) return -2; // display error
  const fullyDescribedStop = await fetchStopAreaDetails(found);
  if (!fullyDescribedStop) return -3; // display error

  query[Object.keys(query).length + 1] = fullyDescribedStop.name;
  queryInternallyUpdated = true;
  router.push({ query });

  selectedStops.value = [...selectedStops.value, fullyDescribedStop];

  return 0;
}

function removeStopPoint(stopArea: FullyDescribedStopArea, stopPoint: StopPoint) {
  if (
    excludedStopPoints.value.find(
      ([stopAreaId, stopPointId]) => stopArea.id === stopAreaId && stopPoint.id === stopPointId,
    )
  )
    return;

  excludedStopPoints.value.push([stopArea.id, stopPoint.id]);

  query["eSP"] = serializeExcludedStopPoints(excludedStopPoints.value);
  if (!query["eSP"].length) delete query["eSP"];
  queryInternallyUpdated = true;
  router.push({ query });

  if (stopArea.details.stopPoints.every((s) => excludedStopPoints.value.find((esp) => s.id === esp[1])))
    removeStopArea(stopArea);
}

function removeStopArea(stopArea: FullyDescribedStopArea) {
  selectedStops.value = selectedStops.value.filter((s) => s.id != stopArea.id);

  let queryNeedUpdate = false;

  if (excludedStopPoints.value.find(([stopAreaId]) => stopAreaId === stopArea.id)) {
    queryNeedUpdate = true;
    excludedStopPoints.value = excludedStopPoints.value.filter(([stopAreaId]) => stopAreaId !== stopArea.id);
    query["eSP"] = serializeExcludedStopPoints(excludedStopPoints.value);
    if (!query["eSP"].length) delete query["eSP"];
  }

  Object.keys(query).forEach((k) => {
    if (query[k] === stopArea.name) {
      queryNeedUpdate = true;
      delete query[k];
    }
  });

  if (queryNeedUpdate) {
    queryInternallyUpdated = true;
    router.push({ query });
  }
}

function getWantedStops(stops: typeof selectedStops.value) {
  return stops.reduce(
    (acc, stopArea: FullyDescribedStopArea) => [
      ...acc,
      ...stopArea.details.stopPoints
        .filter(
          (sp) =>
            !excludedStopPoints.value.find(
              ([stopAreaId, stopPointId]) => stopArea.id === stopAreaId && sp.id === stopPointId,
            ),
        )
        .map((sp: StopPoint) => {
          return { ...sp, stopAreaId: stopArea.id };
        }),
    ],
    [] as (StopPoint & { stopAreaId: StopArea["id"] })[],
  );
}

export {
  selectedStops,
  excludedStopPoints,
  stops,
  addStop,
  removeStopPoint,
  removeStopArea,
  queryUpdated,
  provideQuery,
  getWantedStops,
};
