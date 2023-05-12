<script setup lang="ts">
import {
  fetchRouteRealtime,
  dateCompact,
  duration,
  type Route,
  type RouteRealtime,
  type StopPoint,
  fetchStopPointDetails,
  fetchLineDetails,
  type StopPointDetails,
  type Settings,
  type RouteRealtimeInfos,
  type Schedules,
  fetchVehicleJourney,
  type VehicleJourneySchedule,
  type OperatingRoute,
  FetchStatus,
  now,
} from "@/store";
import { ref } from "vue";
import CloseButton from "@/components/CloseButton.vue";
import RouteHeader from "./RouteHeader.vue";
import RealtimeJourneyModal from "./RealtimeJourneyModal.vue";

interface Props {
  stopPoint: StopPoint;
  settings: Settings;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "softDelete"): void;
  (e: "hardDelete"): void;
}>();

const realtimeRoutesSchedules = ref<{
  [x: Route["id"]]: (RouteRealtime & { route: OperatingRoute }) | { route: OperatingRoute };
}>({});

props.stopPoint.routes.forEach(async (route) => {
  const stopPointDetails = await fetchStopPointDetails(route, props.stopPoint);
  if (!stopPointDetails) return;

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

function refreshRouteRealtime(route: OperatingRoute) {
  route.fetch = FetchStatus.Fetching;
  fetchRouteRealtime(route.stopPointDetails, route.lineDetails, route)
    .then((r) => {
      route.fetch = FetchStatus.Fetched;

      if (r) {
        realtimeRoutesSchedules.value[route.id] = {
          destinations: r.destinations.sort((a, b) => a.waittime - b.waittime),
          route,
        };
        if (
          journeyModalComp.value?.shown &&
          realtimeSchedulesData.value &&
          realtimeSchedulesData.value.route.id === route.id
        ) {
          const tripId = realtimeSchedulesData.value.trip.trip_id;
          const RRI = r.destinations.find((d) => d.trip_id === tripId);
          if (RRI) {
            realtimeSchedulesData.value.trip = RRI;
          }
        }
      } else realtimeRoutesSchedules.value[route.id] = { route };
    })
    .catch((_) => {
      route.fetch = FetchStatus.Errored;
      realtimeRoutesSchedules.value[route.id] = { route };
    })
    .finally(() => {
      setTimeout(() => {
        refreshRouteRealtime(route);
      }, 10_000);
    });
}

const journeyModalComp = ref<InstanceType<typeof RealtimeJourneyModal> | null>(null);

const realtimeSchedulesData = ref<{
  route: OperatingRoute;
  trip: RouteRealtimeInfos<"TREATED">;
  vehicleJourney: VehicleJourneySchedule<"TREATED">[];
} | null>(null);
async function displayRealtimeSchedules(
  stopPointDetails: StopPointDetails,
  trip: RouteRealtimeInfos<"TREATED">,
) {
  const dest = stopPointDetails.schedules.destinations.find(
    (dest) => dest.includes(trip.destination_name) || trip.destination_name.includes(dest),
  );
  if (!dest) return;

  let closestSchedule: [Schedules["datetimes"][string][number] | null, number] = [null, Infinity];
  for (const dt of Object.values(stopPointDetails.schedules.datetimes).flat()) {
    const diff = Math.abs(dt.timestamp * 1_000 - Date.parse(trip.departure_theorique.replace(" ", "T")));
    if (diff < closestSchedule[1]) {
      closestSchedule = [dt, diff];
    }
  }
  if (!closestSchedule[0]) return;

  const vehicleJourney = await fetchVehicleJourney({
    ...closestSchedule[0],
    stopPointId: props.stopPoint.id,
  });
  if (!vehicleJourney) return;

  realtimeSchedulesData.value = {
    route: realtimeRoutesSchedules.value[stopPointDetails.route.id].route,
    trip,
    vehicleJourney,
  };
  journeyModalComp.value?.show(true);
}
</script>

<template>
  <div class="rounded-lg bg-slate-100 p-3 shadow-xl">
    <div class="flex items-center">
      <h3 class="text-center font-bold text-lg mx-auto">📍 {{ stopPoint.name }}</h3>
      <CloseButton
        :border-color="'border-orange-400'"
        :fill-color="'fill-orange-400'"
        @click="emit('softDelete')"
      />
      <CloseButton class="ml-2" @click="emit('hardDelete')" />
    </div>
    <RealtimeJourneyModal
      v-if="realtimeSchedulesData"
      ref="journeyModalComp"
      :route="realtimeSchedulesData.route"
      :trip="realtimeSchedulesData.trip"
      :journey="realtimeSchedulesData.vehicleJourney"
      :settings="settings"
    ></RealtimeJourneyModal>
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
      v-for="(realtimeRoutesSchedule, i) of realtimeRoutesSchedules"
      v-else
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
      <RouteHeader :route="realtimeRoutesSchedule.route"></RouteHeader>
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
          v-for="realtimeRoutesScheduleData of realtimeRoutesSchedule.destinations"
          :key="realtimeRoutesScheduleData.trip_id"
          class="list-none mx-3 m-0"
          @click="
            displayRealtimeSchedules(
              realtimeRoutesSchedule.route.stopPointDetails,
              realtimeRoutesScheduleData,
            )
          "
        >
          <img
            v-if="parseInt(realtimeRoutesScheduleData.realtime) === 1"
            src="/realtime.gif"
            alt="Temps réel"
            class="blue inline w-4 mr-2 align-middle"
          />
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            class="blue inline w-4 mr-2 align-middle"
          >
            <!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. -->
            <path
              d="M75 75L41 41C25.9 25.9 0 36.6 0 57.9V168c0 13.3 10.7 24 24 24H134.1c21.4 0 32.1-25.9 17-41l-30.8-30.8C155 85.5 203 64 256 64c106 0 192 86 192 192s-86 192-192 192c-40.8 0-78.6-12.7-109.7-34.4c-14.5-10.1-34.4-6.6-44.6 7.9s-6.6 34.4 7.9 44.6C151.2 495 201.7 512 256 512c141.4 0 256-114.6 256-256S397.4 0 256 0C185.3 0 121.3 28.7 75 75zm181 53c-13.3 0-24 10.7-24 24V256c0 6.4 2.5 12.5 7 17l72 72c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-65-65V152c0-13.3-10.7-24-24-24z"
            />
          </svg>
          <span
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
            {{
              props.settings.dates
                ? dateCompact(realtimeRoutesScheduleData.fetched + realtimeRoutesScheduleData.waittime)
                : duration(
                    realtimeRoutesScheduleData.waittime > now - realtimeRoutesScheduleData.fetched
                      ? realtimeRoutesScheduleData.waittime - (now - realtimeRoutesScheduleData.fetched)
                      : 0,
                    true,
                    true,
                  ) || "0s"
            }}
          </span>
          <span
            v-if="parseInt(realtimeRoutesScheduleData.realtime) === 1 && props.settings.delay"
            :class="[
              Math.abs(realtimeRoutesScheduleData.departure_delay) < 2.5 * 60_000
                ? 'text-emerald-500'
                : Math.abs(realtimeRoutesScheduleData.departure_delay) < 5 * 60_000
                ? 'text-orange-500'
                : 'text-red-500',
              'inline bg-slate-300 rounded-md ml-1 px-1',
            ]"
          >
            {{
              (realtimeRoutesScheduleData.departure_delay > 0
                ? "+"
                : realtimeRoutesScheduleData.departure_delay < 0
                ? "-"
                : "") + (duration(realtimeRoutesScheduleData.departure_delay, true, true) || "0s")
            }}
          </span>
          <span
            v-if="props.settings.uncertainty"
            class="inline italic bg-slate-300 rounded-md ml-1 px-1 text-"
          >
            {{
              parseInt(realtimeRoutesScheduleData.realtime) === 1 &&
              realtimeRoutesScheduleData.vehicle_position_updated_at &&
              realtimeRoutesScheduleData.vehicle_position_updated_at.length
                ? "±" +
                  duration(
                    now -
                      Date.parse(realtimeRoutesScheduleData.vehicle_position_updated_at.replace(" ", "T")),
                    true,
                    true,
                  )
                : "±10s"
            }}
          </span>
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

.blue {
  filter: invert(72%) sepia(42%) saturate(672%) hue-rotate(165deg) brightness(94%) contrast(89%);
}
</style>
