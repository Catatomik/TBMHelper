<script setup lang="ts">
import { dateCompact, duration, type Settings, FetchStatus, now } from "@/store";
import { ref } from "vue";
import CloseButton from "@/components/CloseButton.vue";
import RouteHeader, { type Checked } from "./RouteHeader.vue";
import RealtimeJourneyModal, { type Modal as RealtimeJourneyModalProps } from "./JourneyModal.vue";
import {
  type StopPoint,
  type Route,
  type RouteRealtime,
  type OperatingRoute,
  fetchStopPointDetails,
  fetchLineDetails,
  fetchRouteRealtime,
  type RouteRealtimeInfos,
  type StopPointDetails,
  type Schedules,
  fetchVehicleJourney,
  extractLineCode,
  type lineType,
} from "@/store/TBM";

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
  [x: Route["id"]]: RouteRealtime & { route: OperatingRoute };
}>({});

props.stopPoint.routes.forEach(async (route) => {
  const stopPointDetails = await fetchStopPointDetails(route, props.stopPoint);
  if (!stopPointDetails) return;

  const lineDetails = (["Bus", "Bus Scolaire", "Tramway"] as lineType[]).includes(
    stopPointDetails.route.line.type,
  )
    ? await fetchLineDetails(route.line)
    : null;

  refreshRouteRealtime({
    ...route,
    stopPointDetails,
    lineDetails:
      lineDetails == null
        ? {
            code: extractLineCode(route.line) ?? "Will be errored if reached",
          }
        : lineDetails,
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
          realtimeSchedulesData.value?.trip &&
          realtimeSchedulesData.value &&
          realtimeSchedulesData.value.route.id === route.id
        ) {
          const tripId = realtimeSchedulesData.value.trip.trip_id;
          const RRI = r.destinations.find((d) => d.trip_id === tripId);
          if (RRI) {
            realtimeSchedulesData.value.trip = RRI;
          }
        }
      } else realtimeRoutesSchedules.value[route.id] = { destinations: [], route };
    })
    .catch((_) => {
      route.fetch = FetchStatus.Errored;
      realtimeRoutesSchedules.value[route.id] = { destinations: [], route };
    })
    .finally(() => {
      setTimeout(() => {
        refreshRouteRealtime(route);
      }, 10_000);
    });
}

const journeyModalComp = ref<InstanceType<typeof RealtimeJourneyModal> | null>(null);
const realtimeSchedulesData = ref<Omit<RealtimeJourneyModalProps, "settings"> | null>(null);

async function displayRealtimeSchedules(
  stopPointDetails: StopPointDetails,
  tripOrSchedule: RouteRealtimeInfos<"TREATED"> | Schedules["datetimes"][string][number],
) {
  let schedule: Schedules["datetimes"][string][number];
  if ("timestamp" in tripOrSchedule) schedule = tripOrSchedule;
  else {
    let closestSchedule: [Schedules["datetimes"][string][number] | null, number] = [null, Infinity];
    for (const dt of Object.values(stopPointDetails.schedules.datetimes).flat()) {
      const diff = Math.abs(
        dt.timestamp * 1_000 - Date.parse(tripOrSchedule.departure_theorique.replace(" ", "T")),
      );
      if (diff < closestSchedule[1]) {
        closestSchedule = [dt, diff];
      }
    }
    if (!closestSchedule[0]) return;
    schedule = closestSchedule[0];
  }

  const journey = await fetchVehicleJourney({
    ...schedule,
    stopPointId: props.stopPoint.id,
  });
  if (!journey) return;

  realtimeSchedulesData.value = {
    route: realtimeRoutesSchedules.value[stopPointDetails.route.id].route,
    trip: "timestamp" in tripOrSchedule ? undefined : tripOrSchedule,
    journey,
  };
  journeyModalComp.value?.show(true);
}

const destShown = ref<Record<StopPoint["routes"][number]["id"], Checked>>({});
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
      :journey="realtimeSchedulesData.journey"
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
      v-for="routeId of (
        Object.keys(realtimeRoutesSchedules) as (keyof typeof realtimeRoutesSchedules)[]
      ).sort((a, b) =>
        realtimeRoutesSchedules[a].route.line.id.localeCompare(realtimeRoutesSchedules[b].route.line.id),
      )"
      v-else
      :key="routeId"
      :class="[
        'mt-2',
        'w-fit px-2 pt-2',
        realtimeRoutesSchedules[routeId].route.fetch === FetchStatus.Errored
          ? 'errored'
          : realtimeRoutesSchedules[routeId].route.fetch === FetchStatus.Fetching
          ? 'fetching'
          : realtimeRoutesSchedules[routeId].route.fetch === FetchStatus.Fetched
          ? 'fetched'
          : '',
        'rounded-lg border-4 border-transparent',
      ]"
    >
      <RouteHeader
        :route="realtimeRoutesSchedules[routeId].route"
        :dest-select="true"
        @update:checked="(checked) => (destShown[routeId] = checked)"
      ></RouteHeader>
      <p v-if="realtimeRoutesSchedules[routeId].route.fetch === FetchStatus.Errored" class="text-red-700">
        Erreur lors de la récupération des horaires
      </p>
      <p v-else-if="!Object.keys(realtimeRoutesSchedules[routeId].destinations).length" class="mx-3">∅</p>
      <div v-else-if="settings.schedules">
        <template
          v-for="(schedules, hour) in realtimeRoutesSchedules[routeId].route.stopPointDetails.schedules
            .datetimes"
          :key="hour"
        >
          <div
            v-if="parseInt(hour.toLocaleString().split(' ')[1]) >= new Date().getHours()"
            class="flex mt-1"
          >
            <div class="bg-slate-300 rounded-l-md dest border-transparent px-1 flex items-center">
              <span class="py-1"> {{ hour.toLocaleString().split(" ")[1] }}h </span>
            </div>
            <div class="ml-2">
              <template v-for="schedule in schedules" :key="schedule.datetime">
                <span
                  v-if="destShown?.[routeId]?.[schedule.directionName] ?? true"
                  class="inline-block bg-slate-200 rounded-sm mr-2 my-1 px-1 dest"
                  :class="[
                    realtimeRoutesSchedules[routeId].route.stopPointDetails.schedules.destinations.length > 1
                      ? `dest-${realtimeRoutesSchedules[routeId].route.stopPointDetails.schedules.destinations
                          .indexOf(schedule.directionName)
                          .toLocaleString()}`
                      : 'border-transparent',
                  ]"
                  @click="
                    displayRealtimeSchedules(
                      realtimeRoutesSchedules[routeId].route.stopPointDetails,
                      schedule,
                    )
                  "
                >
                  {{ new Date(schedule.timestamp * 1_000).getMinutes().toLocaleString().padStart(2, "0") }}
                </span>
              </template>
            </div>
          </div>
        </template>
      </div>
      <ul v-else>
        <template
          v-for="realtimeRoutesScheduleData of realtimeRoutesSchedules[routeId].destinations"
          :key="realtimeRoutesScheduleData.trip_id"
        >
          <li
            v-if="destShown?.[routeId]?.[realtimeRoutesScheduleData.destination_name] ?? true"
            class="list-none mx-2 mt-1"
            @click="
              displayRealtimeSchedules(
                realtimeRoutesSchedules[routeId].route.stopPointDetails,
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
              class="inline dest px-1 rounded"
              :class="[
                realtimeRoutesScheduleData.waittime < 3 * 60_000
                  ? 'text-red-500'
                  : realtimeRoutesScheduleData.waittime < 5 * 60_000
                  ? 'text-orange-500'
                  : realtimeRoutesScheduleData.waittime < 10 * 60_000
                  ? 'text-emerald-500'
                  : '',
                realtimeRoutesSchedules[routeId].route.stopPointDetails.schedules.destinations.length > 1
                  ? `dest-${
                      realtimeRoutesSchedules[routeId].route.stopPointDetails.schedules.destinations
                        .indexOf(realtimeRoutesScheduleData.destination_name)
                        .toLocaleString() ?? 'border-transparent'
                    }`
                  : 'border-transparent',
              ]"
            >
              {{
                settings.dates
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
              v-if="parseInt(realtimeRoutesScheduleData.realtime) === 1 && settings.delay"
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
            <span v-if="settings.uncertainty" class="inline italic bg-slate-300 rounded-md ml-1 px-1">
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
          </li></template
        >
      </ul>
    </div>
  </div>
</template>

<style scoped>
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

<style>
.dest {
  @apply border-2;
}
.dest-0 {
  @apply border-sky-300;
}
.dest-1 {
  @apply border-lime-300;
}
.dest-2 {
  @apply border-fuchsia-300;
}
.dest-3 {
  @apply border-amber-300;
}
.dest-4 {
  @apply border-red-300;
}
</style>
