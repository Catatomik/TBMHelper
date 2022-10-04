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

const realtimeRoutesSchedules = ref<{
  [x: Route["id"]]: (RouteRealtime & { route: Route }) | { route: Route };
}>({});

for (const route of props.stopPoint.routes) refreshRouteRealtime(route);

function refreshRouteRealtime(route: Route, intId?: number) {
  fetchRouteRealtime(stopPointId, route).then((r) => {
    if (intId) clearInterval(intId);
    realtimeRoutesSchedules.value[route.id] = r ? { destinations: r.destinations.sort((a, b) => a.waittime - b.waittime), route } : { route };
    if (r)
      intId = setInterval(() => {
        if ("destinations" in realtimeRoutesSchedules.value[route.id]) {
          const rrs = realtimeRoutesSchedules.value[route.id] as RouteRealtime & { route: Route };
          rrs.destinations = rrs.destinations.map((d) => ({
            ...d,
            waittime: d.waittime > 1_000 ? d.waittime - 1_000 : 0,
          }));
        }
      }, 1_000);
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
    <span v-for="(realtimeRoutesSchedule, i) of realtimeRoutesSchedules" :key="i">
      {{ realtimeRoutesSchedule.route.line.id.includes("TBC") ? "🚌" : "🚋" }}
      <h4 class="font-bold text-base py-1 inline">
        {{ realtimeRoutesSchedule.route.line.name }}
      </h4>
      ➜ {{ realtimeRoutesSchedule.route.name }}
      <p
        v-if="
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
          <span
            :class="[
              realtimeRoutesScheduleData.waittime < 3 * 60_000
                ? 'text-red-500'
                : realtimeRoutesScheduleData.waittime < 5 * 60_000
                ? 'text-orange-500'
                : realtimeRoutesScheduleData.waittime < 10 * 60_000
                ? 'text-emerald-500'
                : '',
            ]"
            >{{ duration(realtimeRoutesScheduleData.waittime, true, true) }} ± 10s</span
          >
        </li>
      </ul>
      <br />
    </span>
  </div>
</template>
