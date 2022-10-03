<script setup lang="ts">
import {
  fetchRouteRealtime,
  duration,
  type Route,
  type RouteRealtime,
  type RouteRealtimeInfos,
  type StopPoint,
} from "@/store";
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
    realtimeRoutesSchedules.value[route.id] = r ? { ...r, route } : { route };
    if (r)
      intId = setInterval(() => {
        if ("destinations" in realtimeRoutesSchedules.value[route.id]) {
          const rrs = realtimeRoutesSchedules.value[route.id] as RouteRealtime & { route: Route };
          rrs.destinations = (
            Object.keys(rrs.destinations) as Array<keyof typeof rrs["destinations"]>
          ).reduce(
            (acc, val) => ({
              ...acc,
              ...rrs.destinations[val].map((rri) => ({ ...rri, waittime: rri.waittime - 1_000 })),
            }),
            {},
          );
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
      <button class="ml-2 border-4 rounded-lg border-red-500 text-center" @click="emit('delete')">❌</button>
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
          v-for="realtimeRoutesScheduleData of (Object.keys(realtimeRoutesSchedule.destinations) as Array<keyof typeof realtimeRoutesSchedule['destinations']>).reduce((acc, val) => [...acc, ...realtimeRoutesSchedule.destinations[val]], [] as RouteRealtimeInfos<'TREATED'>[])"
          :key="realtimeRoutesScheduleData.trip_id"
        >
          {{ duration(realtimeRoutesScheduleData.waittime, true, true) }} ± 10s
        </li>
      </ul>
      <br />
    </span>
  </div>
</template>
