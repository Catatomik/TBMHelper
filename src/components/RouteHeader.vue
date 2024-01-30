<script setup lang="ts">
import RouteName from "./RouteName.vue";
import type { FullyDescribedRoute } from "@/store/TBM";
import { ref } from "vue";

export interface RouteHeader {
  route: FullyDescribedRoute;
}
const props = defineProps<RouteHeader>();

export type Checked = Record<
  FullyDescribedRoute["stopPointDetails"]["schedules"]["destinations"][number],
  boolean
>;

const checked = ref<Checked>(
  props.route.stopPointDetails.schedules.destinations.reduce((acc, v) => ({ ...acc, [v]: true }), {}),
);

const emit = defineEmits<{
  (e: "update:checked", checked: Checked): void;
}>();

emit("update:checked", checked.value);
</script>

<template>
  <RouteName :route="route" />
  <div class="mt-1">
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
