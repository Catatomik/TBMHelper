<script setup lang="ts">
import type { Settings } from "@/store";
import { ref } from "vue";

interface Props {
  shown: boolean;
  modelValue: Settings;
}

const props = defineProps<Props>();

const settings = ref<Settings>(props.modelValue);

defineEmits(["update:modelValue"]);
</script>

<template>
  <div>
    <div
      ref="accordion"
      class="flex overflow-hidden transition-all duration-500 max-w-0 max-h-fit mx-2 my-2 whitespace-nowrap bg-slate-300 rounded-lg"
      :class="{ 'max-w-full': shown }"
    >
      <div class="flex flex-col m-2">
        <div class="inline-block">
          <!-- mb-1 -->
          <span class="mr-2">Incertitudes</span>
          <div class="inline-block p-1 px-2 bg-slate-200 rounded-md">
            <input
              v-model="settings.uncertainty"
              type="checkbox"
              class="bg-transparent text-inherit time"
              @input="$emit('update:modelValue', settings)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
