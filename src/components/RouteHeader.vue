<script setup lang="ts">
import type { OperatingRoute } from "@/store";

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
      props.route.line.id.includes("TBC") || props.route.line.id.includes("GIRONDE")
        ? "🚌"
        : props.route.line.id.includes("TBT")
        ? "🚋"
        : props.route.line.id.includes("SNC")
        ? "🚆"
        : ""
    }}
  </p>
  <h4 class="font-bold text-base py-1 inline align-middle">
    {{ props.route.line.name }}
  </h4>
  <p class="inline align-middle ml-1">➜ {{ props.route.name }}</p>
</template>
