<script setup lang="ts">
import router from "@/router";
import {
  fetchStopAreaDetails,
  fetchStops,
  unique,
  type FullyDescribedStopArea,
  type StopArea,
  type StopPoint,
} from "@/store";
import { onMounted, ref } from "vue";
import { onBeforeRouteUpdate, useRoute } from "vue-router";
import StopPointComp from "../components/StopPoint.vue";

const route = useRoute();
let query = { ...route.query };
let queryInternallyUpdated = false;

onMounted(queryUpdated);
onBeforeRouteUpdate((to) => queryUpdated(to));

const selectedStops = ref<FullyDescribedStopArea[]>([]);
const excludedStopPoints = ref<[StopArea["id"], StopPoint["id"]][]>([]);

async function queryUpdated(to = route) {
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

const stopInput = ref<string>("");
const stops = ref<StopArea[]>([]);

async function refreshStops() {
  if (await addCurrentStop()) return;
  if (stopInput.value.length < 3) return (stops.value = []);
  stops.value = await fetchStops(stopInput.value);
}

async function addCurrentStop() {
  const found = stops.value.find((s) => s.name === stopInput.value);
  if (!found) return false; // display error
  const fullyDescribedStop = await fetchStopAreaDetails(found);
  if (!fullyDescribedStop) return false; // display error

  query[Object.keys(query).length + 1] = fullyDescribedStop.name;
  queryInternallyUpdated = true;
  router.push({ query });

  selectedStops.value = [...selectedStops.value, fullyDescribedStop];

  stopInput.value = "";
  stops.value = [];
  return true;
}

function removeStop(stopArea: FullyDescribedStopArea) {
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

function removeStopPoint(stopArea: StopArea, stopPoint: StopPoint) {
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
        .map(([_, stopPointId]) => stopPointId.substring("stop_point:".length))
        .join("-")}`,
    );
  }

  return partialExcludedStopPoints.join(",");
}

function getWantedStops(stops: typeof selectedStops.value) {
  return stops.reduce(
    (acc, val) => [
      ...acc,
      ...val.details.stopPoints.filter(
        (sp) =>
          !excludedStopPoints.value.find(
            ([stopAreaId, stopPointId]) => val.id === stopAreaId && sp.id === stopPointId,
          ),
      ),
    ],
    [] as StopPoint[],
  );
}
</script>

<template>
  <main>
    <div class="flex flex-col">
      <div class="flex justify-center">
        <input class="my-3 p-1 w-2/3 border-2 border-slate-500 rounded-md shadow-md" type="text"
          placeholder="Chercher un arrêt..." list="selectedStops" :value="stopInput"
          @input="(stopInput = ($event.target as HTMLInputElement).value), refreshStops()"
          @keyup.enter="addCurrentStop()" />

        <datalist id="selectedStops">
          <option v-for="stop of stops" :key="stop.id" :value="stop.name" />
        </datalist>
      </div>
      <h3 v-if="!getWantedStops(selectedStops).length" class="mt-5 text-center font-bold text-lg">
        Aucun arrêt sélectionné
      </h3>
      <div v-else class="my-5 mx-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StopPointComp v-for="stopPoint of getWantedStops(selectedStops)" :key="stopPoint.id" :stop-point="stopPoint"
          @soft-delete="
            removeStopPoint(
              selectedStops.find((s) =>
                s.details.stopPoints.find((sp) => sp.id === stopPoint.id),
              ) as FullyDescribedStopArea,
              stopPoint,
            )
          " @hard-delete="
            removeStop(
              selectedStops.find((s) =>
                s.details.stopPoints.find((sp) => sp.id === stopPoint.id),
              ) as FullyDescribedStopArea,
            )
          " />
      </div>
    </div>
  </main>
</template>
