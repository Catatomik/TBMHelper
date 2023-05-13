<script setup lang="ts">
import router from "@/router";
import { defaultSettings, preferencesKeys, unique, type Settings } from "@/store";
import { onMounted, ref } from "vue";
import { onBeforeRouteUpdate, useRoute } from "vue-router";
import { Preferences } from "@capacitor/preferences";
import StopPointComp from "@/components/StopPoint.vue";
import SettingsComp from "@/components/BaseSettings.vue";
import {
  type FullyDescribedStopArea,
  type StopArea,
  type StopPoint,
  fetchStops,
  fetchStopAreaDetails,
} from "@/store/TBM";

const showSettingsButton = ref<HTMLButtonElement | null>(null);
const settingsComp = ref<InstanceType<typeof SettingsComp> | null>(null);

// May wait for settings & use loader instead
const settings = ref<Settings>({ ...defaultSettings });

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
  const alreadySelected = selectedStops.value.find((s) => s.name === stopInput.value);
  if (alreadySelected) {
    if (excludedStopPoints.value.find(([sp]) => sp === alreadySelected.id)) {
      excludedStopPoints.value = excludedStopPoints.value.filter(([sp]) => sp != alreadySelected.id);
      query["eSP"] = serializeExcludedStopPoints(excludedStopPoints.value);
      if (!query["eSP"].length) delete query["eSP"];
      queryInternallyUpdated = true;
      router.push({ query });
      return (stopInput.value = "");
    } else return (stopInput.value = ""); //display error
  }
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
    removeStop(stopArea);
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

function updateStoredSettings() {
  setTimeout(() => {
    Preferences.set({ key: preferencesKeys.settings, value: JSON.stringify(settings.value) });
  }, 50);
}
</script>

<template>
  <main>
    <div class="flex flex-col">
      <div class="flex my-3">
        <div class="w-2/3 h-fit flex justify-end my-auto mr-1">
          <input
            class="p-1 w-2/3 border-[3px] border-slate-400 rounded-md shadow-md outline-none focus-visible:border-slate-600"
            type="text"
            placeholder="Chercher un arrêt..."
            list="selectedStops"
            :value="stopInput"
            @input="(stopInput = ($event.target as HTMLInputElement).value), refreshStops()"
            @keyup.enter="addCurrentStop()"
          />

          <datalist id="selectedStops">
            <option v-for="stop of stops" :key="stop.id" :value="stop.name" />
          </datalist>
        </div>
        <div class="w-1/3 my-auto flex ml-1">
          <button
            ref="showSettingsButton"
            class="flex h-fit self-center hover:scale-[120%] pulse-scale-focus transition-scale p-2 bg-slate-300 rounded-md"
            :class="{ 'rotate-180': settingsComp?.shown }"
            @click="settingsComp?.show(), showSettingsButton?.blur()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="w-6">
              <!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. -->
              <path
                d="M0 416C0 402.7 10.75 392 24 392H83.66C93.86 359.5 124.2 336 160 336C195.8 336 226.1 359.5 236.3 392H488C501.3 392 512 402.7 512 416C512 429.3 501.3 440 488 440H236.3C226.1 472.5 195.8 496 160 496C124.2 496 93.86 472.5 83.66 440H24C10.75 440 0 429.3 0 416zM192 416C192 398.3 177.7 384 160 384C142.3 384 128 398.3 128 416C128 433.7 142.3 448 160 448C177.7 448 192 433.7 192 416zM352 176C387.8 176 418.1 199.5 428.3 232H488C501.3 232 512 242.7 512 256C512 269.3 501.3 280 488 280H428.3C418.1 312.5 387.8 336 352 336C316.2 336 285.9 312.5 275.7 280H24C10.75 280 0 269.3 0 256C0 242.7 10.75 232 24 232H275.7C285.9 199.5 316.2 176 352 176zM384 256C384 238.3 369.7 224 352 224C334.3 224 320 238.3 320 256C320 273.7 334.3 288 352 288C369.7 288 384 273.7 384 256zM488 72C501.3 72 512 82.75 512 96C512 109.3 501.3 120 488 120H268.3C258.1 152.5 227.8 176 192 176C156.2 176 125.9 152.5 115.7 120H24C10.75 120 0 109.3 0 96C0 82.75 10.75 72 24 72H115.7C125.9 39.54 156.2 16 192 16C227.8 16 258.1 39.54 268.3 72H488zM160 96C160 113.7 174.3 128 192 128C209.7 128 224 113.7 224 96C224 78.33 209.7 64 192 64C174.3 64 160 78.33 160 96z"
              />
            </svg>
          </button>
          <SettingsComp
            ref="settingsComp"
            v-model="settings"
            :init-shown="false"
            @update:model-value="updateStoredSettings"
          />
        </div>
      </div>
      <h3 v-if="!getWantedStops(selectedStops).length" class="mt-5 text-center font-bold text-lg">
        Aucun arrêt sélectionné
      </h3>
      <div v-else class="my-5 mx-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StopPointComp
          v-for="stopPoint of getWantedStops(selectedStops)"
          :key="stopPoint.id"
          :stop-point="stopPoint"
          :settings="settings"
          @soft-delete="
            removeStopPoint(
              selectedStops.find((s) =>
                s.details.stopPoints.find((sp) => sp.id === stopPoint.id),
              ) as FullyDescribedStopArea,
              stopPoint,
            )
          "
          @hard-delete="
            removeStop(
              selectedStops.find((s) =>
                s.details.stopPoints.find((sp) => sp.id === stopPoint.id),
              ) as FullyDescribedStopArea,
            )
          "
        />
      </div>
    </div>
  </main>
</template>

<style scoped>
.transition-scale {
  transition: transform 300ms;
}

@keyframes pulseScale {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.2);
  }

  100% {
    transform: scale(1);
  }
}

.pulse-scale-focus:focus {
  animation: pulseScale 1s;
}
</style>
