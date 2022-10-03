<script setup lang="ts">
import {
  fetchStopDetails,
  fetchStops,
  type FullyDescribedStop,
  type StopArea,
  type StopPoint,
} from "@/store";
import { ref } from "vue";
import StopPointComp from "../components/StopPoint.vue";

const stopInput = ref<string>("");

const stops = ref<StopArea[]>([]);

async function refreshStops() {
  if (stopInput.value.length < 4) return (stops.value = []);
  stops.value = await fetchStops(stopInput.value);
}

async function addCurrentStop() {
  const found = stops.value.find((s) => s.name === stopInput.value);
  if (!found) return false; // display error
  const fullyDescribedStop = await fetchStopDetails(found);
  if (!fullyDescribedStop) return false; // display error
  selectedStops.value.push(fullyDescribedStop);
  stopInput.value = "";
  stops.value = [];
  return true;
}

const selectedStops = ref<FullyDescribedStop[]>([]);
</script>

<template>
  <main>
    <div class="flex flex-col">
      <div class="flex justify-center">
        <input
          class="my-3 p-1 w-2/3 border-2 border-slate-500 rounded-md shadow-md"
          type="text"
          placeholder="Chercher un arrêt..."
          list="selectedStops"
          @input="(stopInput = ($event.target as HTMLInputElement).value), refreshStops()"
          @keyup.enter="addCurrentStop()"
        />

        <datalist id="selectedStops">
          <option v-for="stop in stops" :key="stop.id" :value="stop.name" />
        </datalist>
      </div>
      <h3 v-if="!selectedStops.length" class="mt-5 text-center font-bold text-lg">Aucun arrêt sélectionné</h3>
      <div v-else class="my-5 mx-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StopPointComp
          v-for="stopPoint in selectedStops.reduce((acc, val) => [...acc, ...val.details.stopPoints], [] as StopPoint[])"
          :key="stopPoint.id"
          :stop-point="stopPoint"
          @delete="
            selectedStops.forEach(
              (s) => (s.details.stopPoints = s.details.stopPoints.filter((sp) => sp.id != stopPoint.id)),
            )
          "
        />
      </div>
    </div>
  </main>
</template>
