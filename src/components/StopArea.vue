<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import CustomButton from "./CustomButton.vue";
import { Button } from "@/store/Buttons";
import StopPointComp from "./StopPoint.vue";
import { paused, settings, updateStoredPaused } from "@/store/Storage";
import {
  addStopPoint,
  removeStopPoint,
  removeStopArea,
  getWantedStops,
  selectedStops,
  excludedStopPoints,
} from "@/store/StopsManager";
import {
  extractLineCode,
  fetchLineDetails,
  fetchStopPointDetails,
  type FullyDescribedRoute,
  type FullyDescribedStopArea,
  type lineType,
  type StopPoint,
  type TBMLineType,
} from "@/store/TBM";
import { ref, watch } from "vue";
import { mapAsync } from "@/store";
import RouteName from "./RouteName.vue";

interface Props {
  stopArea: FullyDescribedStopArea;
}

const props = defineProps<Props>();

function forceRefreshStopAreaRealtime() {
  stopPointComps.value.forEach((stopPointComp) => stopPointComp.forceRefreshStopPointRealtime());
}

const stopPointComps = ref<InstanceType<typeof StopPointComp>[]>([]);
const restoreStopComp = ref<InstanceType<typeof BaseModal> | null>(null);

const excludedStopPointsToRestore = ref<(StopPoint & { routes: FullyDescribedRoute[] })[]>([]);

async function getExcludedStopPoints() {
  excludedStopPointsToRestore.value = await mapAsync(
    excludedStopPoints.value
      .filter(([stopAreaId]) => stopAreaId === props.stopArea.id)
      .map<StopPoint | undefined>(([_, stopPointId]) =>
        selectedStops.value
          .flatMap((stopArea) => stopArea.details.stopPoints)
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

  if (!excludedStopPoints.value.length && restoreStopComp.value?.shown) restoreStopComp.value.show(false);
}

watch(excludedStopPoints, getExcludedStopPoints);
</script>

<template>
  <div class="bg-slate-100 rounded-lg shadow-xl py-2">
    <div class="flex items-center mx-2">
      <CustomButton
        :button="Button.Refresh"
        :border-color="'border-violet-500'"
        :fill-color="'fill-violet-500'"
        @click="forceRefreshStopAreaRealtime"
      />
      <CustomButton
        v-if="paused.includes(stopArea.id)"
        :button="Button.Play"
        :border-color="'border-blue-500'"
        :fill-color="'fill-green-500'"
        class="ml-2"
        @click="
          paused = paused.filter((p) => p !== stopArea.id);
          updateStoredPaused();
          forceRefreshStopAreaRealtime();
        "
      />
      <CustomButton
        v-else
        :button="Button.Pause"
        :border-color="'border-blue-500'"
        :fill-color="'fill-orange-500'"
        class="ml-2"
        @click="
          paused.push(stopArea.id);
          updateStoredPaused();
        "
      />
      <h2 class="text-center font-bold text-lg mx-auto">
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
    <div class="my-3 mx-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <StopPointComp
        v-for="stopPoint of getWantedStops(selectedStops).filter(
          (stopPoint) => stopPoint.stopAreaId === stopArea.id,
        )"
        :key="stopPoint.id"
        ref="stopPointComps"
        :stop-point="stopPoint"
        :settings="settings"
        @delete="removeStopPoint(stopArea, stopPoint)"
      />
    </div>

    <BaseModal
      ref="restoreStopComp"
      @update:shown="
        (s) => {
          if (s) getExcludedStopPoints();
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
