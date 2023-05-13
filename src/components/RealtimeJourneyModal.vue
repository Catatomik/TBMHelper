<script setup lang="ts">
import { onMounted, onUpdated, ref } from "vue";
import { dateCompact, duration, getNewTopZIndex, now, type Settings } from "@/store";
import CloseButton from "./CloseButton.vue";
import RouteHeader from "./RouteHeader.vue";
import type { OperatingRoute, RouteRealtimeInfos, VehicleJourneySchedule } from "@/store/TBM";

export interface Modal {
  route: OperatingRoute;
  trip: RouteRealtimeInfos<"TREATED">;
  journey: VehicleJourneySchedule<"TREATED">[];
  settings: Settings;
}
const props = defineProps<Modal>();

const emit = defineEmits<{
  (e: "update:shown", shown: boolean): void;
}>();

const focusDiv = ref<HTMLDivElement | null>(null);

const zIndex = ref<number>(-1);
onMounted(() => {
  zIndex.value = getNewTopZIndex();
});

const shown = ref<boolean>(true);

function show(s = !shown.value) {
  if (s === shown.value) return;
  shown.value = s;
  emit("update:shown", s);
}

defineExpose({
  show,
  shown,
});

onUpdated(async () => {
  if (shown.value)
    setTimeout(() => {
      focusDiv.value?.focus();
    }, 300); // wait for transition on focusDiv to proceed
});
</script>

<template>
  <div
    ref="focusDiv"
    tabindex="10"
    class="flex fixed top-0 left-0 w-full h-full outline-none transition-all duration-150 bg-slate-600/75"
    :class="{
      invisible: !shown,
      'opacity-0': !shown,
      visible: shown,
      'opacity-100': shown,
    }"
    :style="{ zIndex: zIndex }"
    @keyup.esc="show(false)"
    @click="show(false)"
  >
    <div class="mx-auto my-5 w-fit h-auto duration-300" @click="(e) => e.stopPropagation()">
      <div class="shadow-lg flex flex-col w-full h-full rounded-md bg-slate-100">
        <div class="flex flex-shrink-0 items-center justify-between pt-4 p-2 mx-2 border-b">
          <RouteHeader :route="props.route"></RouteHeader>
          <CloseButton class="ml-2 hover:scale-[110%] duration-300 justify-self-end" @click="show(false)" />
        </div>
        <div class="relative py-2 px-4 overflow-auto">
          <div
            v-for="schedule of props.journey.filter(
              (schedule) => schedule.departure_time - trip.departure_delay >= Date.now(),
            )"
            :key="schedule.stop_point.id"
            class="flex bg-slate-200 my-1 rounded-sm p-1"
          >
            <div class="mr-3">{{ schedule.stop_point.name }}</div>
            <div
              class="ml-auto"
              :class="[
                schedule.departure_time - trip.departure_delay - now < 3 * 60_000
                  ? 'text-red-500'
                  : schedule.departure_time - trip.departure_delay - now < 5 * 60_000
                  ? 'text-orange-500'
                  : schedule.departure_time - trip.departure_delay - now < 10 * 60_000
                  ? 'text-emerald-500'
                  : '',
              ]"
            >
              {{
                props.settings.dates
                  ? dateCompact(schedule.departure_time - trip.departure_delay)
                  : duration(schedule.departure_time - trip.departure_delay - now, true, true) || "0s"
              }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
