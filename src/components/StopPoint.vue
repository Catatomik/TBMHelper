<script setup lang="ts">
import {
  fetchRouteRealtime,
  duration,
  type Route,
  type RouteRealtime,
  type StopPoint,
  fetchStopPointDetails,
  fetchLineDetails,
  type StopPointDetails,
  type LineDetails,
} from "@/store";
import { ref } from "vue";

interface Props {
  stopPoint: StopPoint;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "delete"): void;
}>();

enum FetchStatus {
  Errored = 0,
  Fetching = 1,
  Fetched = 2,
}
type OperatingRoute = Route & { stopPointDetails: StopPointDetails } & {
  lineDetails: LineDetails | { externalCode: string };
} & { fetch: FetchStatus };

const realtimeRoutesSchedules = ref<{
  [x: Route["id"]]: (RouteRealtime & { route: OperatingRoute }) | { route: OperatingRoute };
}>({});

fetchStopPointDetails(props.stopPoint.routes[0], props.stopPoint).then((stopPointDetails) => {
  if (!stopPointDetails) return;
  props.stopPoint.routes.forEach(async (route) => {
    const lineDetails = await fetchLineDetails(route.line);
    if (!lineDetails) return;
    refreshRouteRealtime({
      ...route,
      stopPointDetails,
      lineDetails: lineDetails.length
        ? route.line.id.includes("TBT")
          ? { ...lineDetails[0], externalCode: route.line.name.match(/[A-Z]$/)![0] }
          : lineDetails[0]
        : {
            externalCode: route.line.id.includes("TBT")
              ? route.line.name.match(/[A-Z]$/)![0]
              : route.line.id.includes("TBC") // TransGironde
              ? route.line.id.match(/\d{2}$/)![0]
              : route.line.id.includes("GIRONDE") // TransGironde
              ? route.line.id.match(/[A-Z]+:Line:\d+(_R)?$/)![0]
              : route.line.id.includes("SNC") // SNCF
              ? route.line.id.match(/[A-Z]+-[0-9]+$/)![0]
              : "Will be errored if reached",
          },
      fetch: FetchStatus.Fetching,
    });
  });
});

function refreshRouteRealtime(route: OperatingRoute, intId?: number) {
  route.fetch = FetchStatus.Fetching;
  fetchRouteRealtime(route.stopPointDetails, route.lineDetails, route)
    .then((r) => {
      route.fetch = FetchStatus.Fetched;

      realtimeRoutesSchedules.value[route.id] = r
        ? { destinations: r.destinations.sort((a, b) => a.waittime - b.waittime), route }
        : { route };
      if (r) if (intId) clearInterval(intId);
      intId = setInterval(() => {
        if ("destinations" in realtimeRoutesSchedules.value[route.id]) {
          const rrs = realtimeRoutesSchedules.value[route.id] as RouteRealtime & { route: OperatingRoute };
          rrs.destinations = rrs.destinations.map((d) => ({
            ...d,
            waittime: d.waittime > 1_000 ? d.waittime - 1_000 : 0,
          }));
        }
      }, 1_000);
    })
    .catch((e) => {
      route.fetch = FetchStatus.Errored;
      realtimeRoutesSchedules.value[route.id] = { route };
    })
    .finally(() => {
      setTimeout(() => {
        refreshRouteRealtime(route, intId);
      }, 10_000);
    });
}
</script>

<template>
  <div class="rounded-lg p-3 shadow-xl">
    <div class="flex justify-center items-center">
      <h3 class="text-center font-bold text-lg">📍 {{ stopPoint.name }}</h3>
      <button class="ml-2 border-4 rounded-lg border-red-500 text-center select-none" @click="emit('delete')">
        ❌
      </button>
    </div>
    <hr class="my-2" />
    <p
      v-if="
        Object.values(realtimeRoutesSchedules).every(
          (rrs) => !('destinations' in rrs) || rrs.route.fetch === FetchStatus.Errored,
        )
      "
      class="text-red-700"
    >
      Impossible de récupérer les horaires de cet arrêt
    </p>
    <div
      v-else
      v-for="(realtimeRoutesSchedule, i) of realtimeRoutesSchedules"
      :key="i"
      :class="[
        'mt-2',
        'w-fit px-2 pt-2',
        realtimeRoutesSchedule.route.fetch === FetchStatus.Errored
          ? 'errored'
          : realtimeRoutesSchedule.route.fetch === FetchStatus.Fetching
          ? 'fetching'
          : realtimeRoutesSchedule.route.fetch === FetchStatus.Fetched
          ? 'fetched'
          : '',
        'rounded-lg border-4 border-transparent',
      ]"
    >
      <img
        v-if="'id' in realtimeRoutesSchedule.route.lineDetails"
        width="25"
        class="inline align-middle"
        :src="realtimeRoutesSchedule.route.lineDetails.picto"
      />
      <p class="mx-1 inline align-middle">
        {{
          realtimeRoutesSchedule.route.line.id.includes("TBC") ||
          realtimeRoutesSchedule.route.line.id.includes("GIRONDE")
            ? "🚌"
            : realtimeRoutesSchedule.route.line.id.includes("TBT")
            ? "🚋"
            : realtimeRoutesSchedule.route.line.id.includes("SNC")
            ? "🚆"
            : ""
        }}
      </p>
      <h4 class="font-bold text-base py-1 inline align-middle">
        {{ realtimeRoutesSchedule.route.line.name }}
      </h4>
      <p class="inline align-middle ml-1">➜ {{ realtimeRoutesSchedule.route.name }}</p>
      <p v-if="realtimeRoutesSchedule.route.fetch === FetchStatus.Errored" class="text-red-700">
        Erreur lors de la récupération des horaires
      </p>
      <p
        v-else-if="
          !('destinations' in realtimeRoutesSchedule) ||
          !Object.keys(realtimeRoutesSchedule.destinations).length
        "
        class="mx-3"
      >
        ∅
      </p>
      <ul v-else>
        <li
          class="list-disc list-inside mx-3"
          v-for="realtimeRoutesScheduleData of realtimeRoutesSchedule.destinations"
          :key="realtimeRoutesScheduleData.trip_id"
        >
          <p
            :class="[
              realtimeRoutesScheduleData.waittime < 3 * 60_000
                ? 'text-red-500'
                : realtimeRoutesScheduleData.waittime < 5 * 60_000
                ? 'text-orange-500'
                : realtimeRoutesScheduleData.waittime < 10 * 60_000
                ? 'text-emerald-500'
                : '',
              'inline',
            ]"
          >
            {{ duration(realtimeRoutesScheduleData.waittime, true, true) }} ±
            {{
              realtimeRoutesScheduleData.vehicle_position_updated_at &&
              realtimeRoutesScheduleData.vehicle_position_updated_at.length
                ? duration(
                    Date.now() -
                      Date.parse(realtimeRoutesScheduleData.vehicle_position_updated_at.replace(" ", "T")),
                    true,
                    true,
                  )
                : "10s"
            }}
          </p>
          <p class="inline ml-2">
            {{
              realtimeRoutesSchedule.route.stopPointDetails.schedules.destinations.length > 1
                ? `➜ ${realtimeRoutesScheduleData.destination_name.replace(/\./g, " ")}`
                : ""
            }}
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>

<style>
@keyframes errored {
  from {
    border-color: rgba(220, 38, 38, 1);
  }

  to {
    border-color: rgba(220, 38, 38, 0);
  }
}

.errored {
  animation: 1.5s errored linear 0s infinite;
}

@keyframes fetching {
  from {
    border-color: rgba(251, 146, 60, 1);
  }

  to {
    border-color: rgba(251, 146, 60, 0);
  }
}

.fetching {
  animation: 2s fetching ease-in-out 0s infinite;
}

@keyframes fetched {
  from {
    border-color: rgba(52, 211, 153, 1);
  }

  to {
    border-color: rgba(52, 211, 153, 0);
  }
}

.fetched {
  animation: 2.5s fetched ease-out 0s;
}
</style>
