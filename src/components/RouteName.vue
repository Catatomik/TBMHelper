<script setup lang="ts">
import type { FullyDescribedRoute } from "@/store/TBM";

interface Props {
  route: FullyDescribedRoute;
}

defineProps<Props>();
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
        route.stopPointDetails.route.line.type === "Bus de Nuit" ||
        route.stopPointDetails.route.line.type === "Bus Scolaire"
          ? "🚌"
          : route.stopPointDetails.route.line.type === "Tramway"
            ? "🚊"
            : route.stopPointDetails.route.line.type === "Train régional / TER"
              ? "🚆"
              : ""
      }}
    </p>
    <h4 class="font-bold text-base py-1 inline align-middle">
      {{ route.line.name }}
    </h4>
  </div>
</template>
