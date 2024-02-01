<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import CustomButton from "./CustomButton.vue";
import { Button } from "@/store/Buttons";
import StopPointComp from "./StopPoint.vue";
import {
  fetchMinimized,
  setMinimized,
  setUnminimized,
  minimized,
  paused,
  settings,
  setPaused,
  setUnpaused,
} from "@/store/Storage";
import {
  addStopPoint,
  removeStopPoint,
  removeStopArea,
  getWantedStops,
  selectedStopAreas,
  excludedStopPoints,
} from "@/store/StopsManager";
import {
  extractLineCode,
  fetchLineDetails,
  fetchStopPointDetails,
  type FullyDescribedRoute,
  type StopAreaDetails,
  type lineType,
  type StopPoint,
  type TBMLineType,
} from "@/store/TBM";
import { ref, watch } from "vue";
import { mapAsync } from "@/store";
import RouteName from "./RouteName.vue";

interface Props {
  stopArea: StopAreaDetails;
}

const props = defineProps<Props>();

function forceRefreshStopAreaRealtime() {
  stopPointComps.value.forEach((stopPointComp) => stopPointComp.forceRefreshStopPointRealtime());
}

const stopPointComps = ref<InstanceType<typeof StopPointComp>[]>([]);
const restoreStopComp = ref<InstanceType<typeof BaseModal> | null>(null);

const excludedStopPointsToRestore = ref<(StopPoint & { routes: FullyDescribedRoute[] })[]>([]);

async function getExcludedStopPointsToRestore() {
  excludedStopPointsToRestore.value = await mapAsync(
    excludedStopPoints.value
      .filter(([stopAreaId]) => stopAreaId === props.stopArea.id)
      .map<StopPoint | undefined>(([_, stopPointId]) =>
        selectedStopAreas.value
          .flatMap((stopArea) => stopArea.stopPoints)
          .find((stopPoint) => stopPoint.id === stopPointId),
      )
      .filter((sp): sp is StopPoint => sp !== undefined),
    async (stopPoint) => {
      return {
        ...stopPoint,
        // NEED DETAILS ?
        routes: (
          await Promise.all(
            stopPoint.routes.map(async (route): Promise<FullyDescribedRoute | null> => {
              const stopPointDetails = await fetchStopPointDetails(route, stopPoint);
              if (!stopPointDetails) return null;

              const lineDetails = ((
                ["Bus", "Bus Scolaire", "Bus de Nuit", "Tramway"] satisfies TBMLineType[] as lineType[]
              ).includes(stopPointDetails.route.line.type)
                ? await fetchLineDetails(route.line)
                : null) ?? {
                externalCode: extractLineCode(route.line) ?? "Will be errored if reached",
              };
              return { ...route, stopPointDetails, lineDetails };
            }),
          )
        ).filter((r): r is FullyDescribedRoute => r !== null),
      };
    },
  );

  if (!excludedStopPointsToRestore.value.length && restoreStopComp.value?.shown)
    restoreStopComp.value.show(false);
}

watch(excludedStopPoints, getExcludedStopPointsToRestore);

fetchMinimized();
</script>

<template>
  <div class="bg-slate-100 rounded-lg shadow-xl py-2">
    <div class="flex items-center mx-2">
      <span class="flex" :disabled-load="minimized.includes(stopArea.id)">
        <CustomButton
          :button="Button.Refresh"
          :border-color="'border-violet-500'"
          :fill-color="'fill-violet-500'"
          @click="forceRefreshStopAreaRealtime"
        />
      </span>
      <CustomButton
        v-if="paused.includes(stopArea.id) || minimized.includes(stopArea.id)"
        :button="Button.Play"
        :border-color="'border-blue-500'"
        :fill-color="'fill-green-500'"
        class="ml-2"
        @click="
          setUnpaused(stopArea.id);
          setUnminimized(stopArea.id);
          forceRefreshStopAreaRealtime();
        "
      />
      <CustomButton
        v-else
        :button="Button.Pause"
        :border-color="'border-blue-500'"
        :fill-color="'fill-yellow-500'"
        class="ml-2"
        @click="setPaused(stopArea.id)"
      />
      <h2
        class="grow text-center font-bold text-lg mx-auto"
        @click="
          if (minimized.includes(stopArea.id)) {
            setUnminimized(stopArea.id);
            setUnpaused(stopArea.id);
            forceRefreshStopAreaRealtime();
          } else setMinimized(stopArea.id);
        "
      >
        📍
        {{ stopArea.name }}
      </h2>
      <CustomButton
        v-if="excludedStopPoints.find(([sa]) => sa === stopArea.id)"
        :button="Button.Add"
        :border-color="'border-green-500'"
        :fill-color="'fill-green-500'"
        @click="restoreStopComp?.show()"
      />
      <CustomButton
        :button="Button.Close"
        :border-color="'border-red-500'"
        :fill-color="'fill-red-500'"
        class="ml-2"
        @click="removeStopArea(stopArea)"
      />
    </div>
    <Transition name="collapse">
      <div v-show="!minimized.includes(stopArea.id)" class="grid grid-rows-[1fr]">
        <div
          class="mx-2 my-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-hidden transition-margin"
        >
          <StopPointComp
            v-for="stopPoint of getWantedStops(selectedStopAreas).filter(
              (stopPoint) => stopPoint.stopAreaId === stopArea.id,
            )"
            :key="stopPoint.id"
            ref="stopPointComps"
            :stop-point="stopPoint"
            :settings="settings"
            @delete="removeStopPoint(stopArea, stopPoint)"
          />
        </div>
      </div>
    </Transition>

    <BaseModal
      ref="restoreStopComp"
      @update:shown="
        (s) => {
          if (s) getExcludedStopPointsToRestore();
        }
      "
    >
      <template #title>
        <h1 class="text-2xl m-2 text-center">
          Restaurer des arrêts à <b>{{ stopArea.name }}</b>
        </h1>
      </template>
      <template #content>
        <div
          v-for="stopPoint of excludedStopPointsToRestore"
          :key="stopPoint.id"
          class="p-2 rounded-sm bg-slate-200"
        >
          <div class="flex items-center">
            <h2 class="text-center font-bold text-lg mx-auto">
              📍
              {{ stopArea.name }}
            </h2>
            <CustomButton
              :button="Button.Add"
              :border-color="'border-green-500'"
              :fill-color="'fill-green-500'"
              @click="addStopPoint(stopArea, stopPoint.id)"
            />
          </div>
          <div v-for="route of stopPoint.routes" :key="route.id" class="flex gap-x-1">
            <RouteName :route="route" />
            <span>➜ {{ route.name }}</span>
          </div>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<style>
.disabled-load-wrapper {
  @apply opacity-70 !important;
  @apply cursor-not-allowed !important;
}

.disabled-load {
  pointer-events: none !important;
}

[disabled-load="true"] {
  @apply disabled-load-wrapper;
}

[disabled-load="true"] * {
  @apply disabled-load;
}

.collapse-enter-active,
.collapse-leave-active {
  @apply transition-[grid-template-rows];
  @apply duration-700;
}

.collapse-enter-active .transition-margin,
.collapse-leave-active .transition-margin {
  @apply transition-[margin];
  @apply duration-1000;
}

.collapse-enter-from,
.collapse-leave-to {
  @apply grid-rows-[0fr] !important;
}

.collapse-enter-from .transition-margin,
.collapse-leave-to .transition-margin {
  @apply my-0 !important;
}
</style>
