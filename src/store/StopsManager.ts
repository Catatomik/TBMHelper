import { ref } from "vue";
import { fetchStopAreaDetails, type StopAreaDetails, type StopArea, type StopPoint } from "./TBM";
import router from "@/router";
import { type LocationQuery, type RouteLocationNormalized } from "vue-router";
import { unique } from ".";

const selectedStopAreas = ref<StopAreaDetails[]>([]);
const excludedStopPoints = ref<[StopArea["id"], StopPoint["id"]][]>([]);

const stopAreas = ref<StopArea[]>([]);

let query: LocationQuery = {};
let queryInternallyUpdated = false;

function provideQuery(q: LocationQuery) {
  query = { ...q };
}

// In ascending order
function getStopAreaKeysFromQuery(q: LocationQuery) {
  return Object.keys(q)
    .filter((k) => !isNaN(parseInt(k)))
    .sort((a, b) => parseInt(a) - parseInt(b));
}

async function queryUpdated(to: RouteLocationNormalized) {
  if (queryInternallyUpdated) {
    queryInternallyUpdated = false;
    return;
  }
  query = { ...to.query };

  const stopAreaKeys = getStopAreaKeysFromQuery(to.query);
  for (const k of stopAreaKeys) {
    const providedStopAreaId = to.query[k] as string;

    const deserializedStopAreaId = deserializeStopAreaId(providedStopAreaId);
    if (selectedStopAreas.value.find((sa) => sa.id === deserializedStopAreaId)) continue;

    const StopAreaDetails = await fetchStopAreaDetails({ id: deserializedStopAreaId });
    if (!StopAreaDetails) {
      delete query[k];
      queryInternallyUpdated = true;
      router.push({ query });
      continue;
    }
    selectedStopAreas.value.splice(parseInt(k) - 1, 0, StopAreaDetails);
  }

  selectedStopAreas.value = selectedStopAreas.value.filter((sa) => {
    const serializedStopAreaId = serializeStopAreaId(sa.id);
    return stopAreaKeys.find((k) => query[k] === serializedStopAreaId);
  });

  excludedStopPoints.value = await deserializeExcludedStopPoints(
    typeof query["eSP"] === "string" ? query["eSP"] : "",
  );
}

function serializeStopPointId(stopPointId: StopPoint["id"]) {
  return stopPointId.substring("stop_point:".length).replace(/-/g, "+");
}

function deserializeStopPointId(stopPointId: string): StopPoint["id"] {
  return `stop_point:${stopPointId}`.replace(/\+/g, "-") as StopPoint["id"];
}

async function deserializeExcludedStopPoints(serializedExcludedStopPoints: string) {
  const stopAreas = serializedExcludedStopPoints.split(",");
  if (!stopAreas.length) return [];

  const excludedStopPoints = [] as [StopArea["id"], StopPoint["id"]][];

  for (const stopAreaString of stopAreas) {
    const stopAreaKey = stopAreaString.match(/^\d+/)?.[0];
    if (!stopAreaKey || !query[stopAreaKey]) continue;

    const stopAreaDetails = await fetchStopAreaDetails({
      id: deserializeStopAreaId(query[stopAreaKey] as string),
    });
    if (!stopAreaDetails) continue;

    const serializedStopPointIds = stopAreaString.split("-");

    for (const serializedStopPointId of serializedStopPointIds) {
      const deserializedStopPointId = deserializeStopPointId(serializedStopPointId);
      const stopPoint = stopAreaDetails.stopPoints.find((s) => s.id === deserializedStopPointId);
      if (!stopPoint) continue;

      excludedStopPoints.push([stopAreaDetails.id, stopPoint.id]);
    }
  }

  return excludedStopPoints;
}

function serializeExcludedStopPoints(excludedStopPoints: [StopArea["id"], StopPoint["id"]][]) {
  const partialExcludedStopPoints = [] as string[];

  for (const stopAreaId of excludedStopPoints.map(([stopArea]) => stopArea).filter(unique)) {
    const stopArea = selectedStopAreas.value.find((s) => s.id === stopAreaId);
    if (!stopArea) continue;

    const serializedStopAreaId = serializeStopAreaId(stopArea.id);
    const stopAreaKey = Object.keys(query).find((k) => query[k] === serializedStopAreaId);
    if (stopAreaKey === undefined) continue;

    partialExcludedStopPoints.push(
      `${stopAreaKey}-${excludedStopPoints
        .filter(([stopArea]) => stopArea === stopAreaId)
        .map((esp) => serializeStopPointId(esp[1]))
        .join("-")}`,
    );
  }

  return partialExcludedStopPoints.join(",");
}

function serializeStopAreaId(stopAreaId: StopArea["id"]) {
  return stopAreaId.substring("stop_area:".length).replace(/-/g, "+");
}

function deserializeStopAreaId(stopAreaId: string): StopArea["id"] {
  return `stop_area:${stopAreaId}`.replace(/\+/g, "-") as StopArea["id"];
}

async function addStopArea(stopArea: StopArea) {
  const alreadySelected = selectedStopAreas.value.find((s) => s.id === stopArea.id);
  if (alreadySelected) {
    if (excludedStopPoints.value.find(([sa]) => sa === alreadySelected.id)) {
      excludedStopPoints.value = excludedStopPoints.value.filter(([sa]) => sa != alreadySelected.id);
      query["eSP"] = serializeExcludedStopPoints(excludedStopPoints.value);
      if (!query["eSP"].length) delete query["eSP"];
      queryInternallyUpdated = true;
      router.push({ query });
      return 1;
    } else return -1; //display error
  }

  const StopAreaDetails = await fetchStopAreaDetails(stopArea);
  if (!StopAreaDetails) return -2; // display error

  query[getStopAreaKeysFromQuery(query).length + 1] = serializeStopAreaId(StopAreaDetails.id);
  queryInternallyUpdated = true;
  router.push({ query });

  selectedStopAreas.value.push(StopAreaDetails);

  return 0;
}

function removeStopArea(stopArea: StopAreaDetails) {
  selectedStopAreas.value = selectedStopAreas.value.filter((s) => s.id != stopArea.id);

  let queryNeedUpdate = false;

  if (excludedStopPoints.value.find(([stopAreaId]) => stopAreaId === stopArea.id)) {
    queryNeedUpdate = true;
    excludedStopPoints.value = excludedStopPoints.value.filter(([stopAreaId]) => stopAreaId !== stopArea.id);
    query["eSP"] = serializeExcludedStopPoints(excludedStopPoints.value);
    if (!query["eSP"].length) delete query["eSP"];
  }

  const serializedStopAreaId = serializeStopAreaId(stopArea.id);
  Object.keys(query).forEach((k) => {
    if (query[k] === serializedStopAreaId) {
      queryNeedUpdate = true;
      delete query[k];
    }
  });

  // Re-index stop areas
  let gap = 0;
  getStopAreaKeysFromQuery(query).forEach((k, i, arr) => {
    const intK = parseInt(k);

    // Init, full rename case
    if (i === 0) gap = intK - 1;

    if (gap) {
      query[(intK - gap).toString()] = query[k];
      delete query[k];

      const keyMatcher = new RegExp(`(^|(?<=,))${intK}-`, "g");
      if (typeof query["eSP"] === "string" && query["eSP"].match(keyMatcher))
        query["eSP"] = query["eSP"].replace(keyMatcher, `${intK - gap}-`);
    }

    // End of array, do not compute next gap
    if (i === arr.length - 1) return;
    const intK2 = parseInt(arr[i + 1]);

    // Next gap
    gap += intK2 - intK - 1;
  });
  if (gap) queryNeedUpdate = true;

  if (queryNeedUpdate) {
    queryInternallyUpdated = true;
    router.push({ query });
  }
}

async function addStopPoint(
  stopArea: Parameters<typeof fetchStopAreaDetails>[0],
  stopPointId: StopPoint["id"],
) {
  if (excludedStopPoints.value.find(([_, sp]) => sp === stopPointId)) {
    excludedStopPoints.value = excludedStopPoints.value.filter(([_, sp]) => sp != stopPointId);
    query["eSP"] = serializeExcludedStopPoints(excludedStopPoints.value);
    if (!query["eSP"].length) delete query["eSP"];
    queryInternallyUpdated = true;
    router.push({ query });
    return 1;
  }

  // Add stop area, exclude all stop points except stopPointId
  const StopAreaDetails = await fetchStopAreaDetails(stopArea);
  if (!StopAreaDetails) return -3; // display error

  for (const stopPoint of StopAreaDetails.stopPoints)
    excludedStopPoints.value.push([stopArea.id, stopPoint.id]);

  selectedStopAreas.value.push(StopAreaDetails);

  return 0;
}

function removeStopPoint(stopArea: StopAreaDetails, stopPoint: StopPoint) {
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

  if (stopArea.stopPoints.every((s) => excludedStopPoints.value.find((esp) => s.id === esp[1])))
    removeStopArea(stopArea);
}

function getWantedStops(stopAreas: typeof selectedStopAreas.value) {
  return stopAreas.reduce(
    (acc, stopArea: StopAreaDetails) => [
      ...acc,
      ...stopArea.stopPoints
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
  selectedStopAreas,
  excludedStopPoints,
  stopAreas,
  addStopArea,
  addStopPoint,
  removeStopPoint,
  removeStopArea,
  queryUpdated,
  provideQuery,
  getWantedStops,
};
