<script setup lang="ts">
import router from "@/router";
import {
  fetchStopAreaDetails,
  fetchStops,
  type FullyDescribedStop,
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

const selectedStops = ref<FullyDescribedStop[]>([]);
const excludedStopPoints = ref<`${StopArea["id"]}-${StopPoint["id"]}`[]>([]);

async function queryUpdated(to = route) {
  if (queryInternallyUpdated) {
    queryInternallyUpdated = false;
    return;
  }
  query = { ...to.query };

  excludedStopPoints.value = (
    to.query["excludedStopPoints"] === undefined
      ? []
      : to.query["excludedStopPoints"] instanceof Array
      ? to.query["excludedStopPoints"]
      : [to.query["excludedStopPoints"]]
  ) as `${StopArea["id"]}-${StopPoint["id"]}`[];

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
}

const stopInput = ref<string>("");
const stops = ref<StopArea[]>([]);

async function refreshStops() {
  if (await addCurrentStop()) return;
  if (stopInput.value.length < 4) return (stops.value = []);
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

function removeStop(stop: FullyDescribedStop) {
  selectedStops.value = selectedStops.value.filter((s) => s.id != stop.id);

  let queryNeedUpdate = false;
  Object.keys(query).forEach((k) => {
    if (query[k] === stop.name) {
      queryNeedUpdate = true;
      delete query[k];
    }
    if (queryNeedUpdate) {
      queryInternallyUpdated = true;
      router.push({ query });
    }
  });
}

function removeStopPoint(stopArea: StopArea, stopPoint: StopPoint) {
  if (excludedStopPoints.value.includes(`${stopArea.id}-${stopPoint.id}`)) return;

  excludedStopPoints.value.push(`${stopArea.id}-${stopPoint.id}`);

  query["excludedStopPoints"] = excludedStopPoints.value;
  queryInternallyUpdated = true;
  router.push({ query });
}
</script>

<template>
  <main>
    <div class="flex flex-col">
      <div class="flex justify-center">
        <input
          class="my-3 p-1 w-2/3 border-2 border-slate-500 rounded-md shadow-md"
          type="text"
          placeholder="Chercher un arrêt..."
          list="selectedStops"
          :value="stopInput"
          @input="(stopInput = ($event.target as HTMLInputElement).value), refreshStops()"
          @keyup.enter="addCurrentStop()"
        />

        <datalist id="selectedStops">
          <option v-for="stop in stops" :key="stop.id" :value="stop.name" />
        </datalist>
      </div>
      <h3 v-if="!selectedStops.length" class="mt-5 text-center font-bold text-lg">Aucun arrêt sélectionné</h3>
      <div v-else class="my-5 mx-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StopPointComp
          v-for="stopPoint in selectedStops.reduce((acc, val) => [...acc, ...val.details.stopPoints.filter(sp => !excludedStopPoints.includes(`${val.id}-${sp.id}`))], [] as StopPoint[])"
          :key="stopPoint.id"
          :stop-point="stopPoint"
          @soft-delete="
            removeStopPoint(
              selectedStops.find((s) =>
                s.details.stopPoints.find((sp) => sp.id === stopPoint.id),
              ) as FullyDescribedStop,
              stopPoint,
            )
          "
          @hard-delete="
            removeStop(
              selectedStops.find((s) =>
                s.details.stopPoints.find((sp) => sp.id === stopPoint.id),
              ) as FullyDescribedStop,
            )
          "
        />
      </div>
    </div>
  </main>
</template>
