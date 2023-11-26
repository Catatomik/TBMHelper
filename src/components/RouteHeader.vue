<script setup lang="ts">
import type { OperatingRoute } from "@/store/TBM";
import { ref, type Ref } from "vue";

export interface RouteHeader {
  route: OperatingRoute;
  destSelect?: boolean;
}
const props = withDefaults(defineProps<RouteHeader>(), {
  destSelect: false,
});

export type Checked = Record<
  OperatingRoute["stopPointDetails"]["schedules"]["destinations"][number],
  boolean
>;

const checked: Ref<Checked> = ref(
  props.route.stopPointDetails.schedules.destinations.reduce((acc, v) => ({ ...acc, [v]: true }), {}),
);

const emit = defineEmits<{
  (e: "update:checked", checked: Checked): void;
}>();

emit("update:checked", checked.value);
</script>

<template>
  <div>
    <img
      v-if="'id' in route.lineDetails"
      width="25"
      class="inline align-middle"
      :src="route.lineDetails.picto"
    />
    <p class="mx-1 inline align-middle">
      {{
        route.stopPointDetails.route.line.type === "Bus" ||
        route.stopPointDetails.route.line.type === "Autocar" ||
        route.stopPointDetails.route.line.type === "Bus Scolaire"
          ? "🚌"
          : route.stopPointDetails.route.line.type === "Tramway"
            ? "🚋"
            : route.stopPointDetails.route.line.type === "Train régional / TER"
              ? "🚆"
              : ""
      }}
    </p>
    <h4 class="font-bold text-base py-1 inline align-middle">
      {{ route.line.name }}
    </h4>
  </div>
  <div v-if="destSelect" class="mt-1">
    <div
      v-for="destination in route.stopPointDetails.schedules.destinations"
      :key="destination"
      class="mt-1 w-fit"
    >
      <span
        class="flex items-center dest rounded px-1"
        :class="[
          route.stopPointDetails.schedules.destinations.length > 1
            ? `dest-${route.stopPointDetails.schedules.destinations.indexOf(destination).toLocaleString()}`
            : 'border-transparent',
        ]"
      >
        <input
          v-if="route.stopPointDetails.schedules.destinations.length > 1"
          v-model="checked[destination]"
          type="checkbox"
          @input="emit('update:checked', checked)"
        />
        <p v-else class="inline">➜</p>
        <p class="inline ml-2">
          {{ destination }}
        </p>
      </span>
    </div>
  </div>
</template>
