<script setup lang="ts">
import type { OperatingRoute } from "@/store/TBM";

export interface RouteHeader {
  route: OperatingRoute;
}
const props = defineProps<RouteHeader>();
</script>

<template>
  <img
    v-if="'id' in props.route.lineDetails"
    width="25"
    class="inline align-middle"
    :src="props.route.lineDetails.picto"
  />
  <p class="mx-1 inline align-middle">
    {{
      props.route.stopPointDetails.route.line.type === "Bus" ||
      props.route.stopPointDetails.route.line.type === "Autocar" ||
      props.route.stopPointDetails.route.line.type === "Bus Scolaire"
        ? "🚌"
        : props.route.stopPointDetails.route.line.type === "Tramway"
        ? "🚋"
        : props.route.stopPointDetails.route.line.type === "Train régional / TER"
        ? "🚆"
        : ""
    }}
  </p>
  <h4 class="font-bold text-base py-1 inline align-middle">
    {{ props.route.line.name }}
  </h4>
  <p class="inline align-middle ml-1">➜ {{ props.route.name }}</p>
</template>
