<script setup lang="ts">
import { fetchRouteRealtime, duration, type Route, type RouteRealtime, type StopPoint } from "@/store";
import { ref } from "vue";

interface Props {
  stopPoint: StopPoint;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "delete"): void;
}>();

const stopPointId = props.stopPoint.id.match(/\d+$/)![0];

enum FetchStatus {
  Errored = 0,
  Fetching = 1,
  Fetched = 2,
}
type OperatingRoute = Route & { fetch: FetchStatus };

const realtimeRoutesSchedules = ref<{
  [x: Route["id"]]: (RouteRealtime & { route: OperatingRoute }) | { route: OperatingRoute };
}>({});

for (const route of props.stopPoint.routes) refreshRouteRealtime({ ...route, fetch: FetchStatus.Fetching });

function refreshRouteRealtime(route: OperatingRoute, intId?: number) {
  route.fetch = FetchStatus.Fetching;
  fetchRouteRealtime(stopPointId, route)
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
    .catch((_) => {
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
        'w-fit p-2',
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
      {{ realtimeRoutesSchedule.route.line.id.includes("TBC") ? "🚌" : "🚋" }}
      <h4 class="font-bold text-base py-1 inline">
        {{ realtimeRoutesSchedule.route.line.name }}
      </h4>
      ➜ {{ realtimeRoutesSchedule.route.name }}
      <p v-if="realtimeRoutesSchedule.route.fetch === FetchStatus.Errored" class="text-red-700">
        Erreur lors de la récupération des horaires
      </p>
      <p
        v-else-if="
          !('destinations' in realtimeRoutesSchedule) ||
          !Object.keys(realtimeRoutesSchedule.destinations).length
        "
        class="inline"
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
            {{ duration(realtimeRoutesScheduleData.waittime, true, true) }} ± 10s
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
