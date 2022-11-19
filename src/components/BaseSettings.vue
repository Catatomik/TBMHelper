<script setup lang="ts">
import type { Settings } from "@/store";
import { onUpdated, ref } from "vue";
import BaseModal from "@/components/BaseModal.vue";

const modalComp = ref<InstanceType<typeof BaseModal> | null>(null);

interface Props {
  initShown?: boolean;
  modelValue: Settings;
}
const props = withDefaults(defineProps<Props>(), { initShown: false });
const settings = ref<Settings>(props.modelValue);

const emit = defineEmits<{
  (e: "update:shown", shown: boolean): void;
  (e: "update:modelValue", settings: Settings): void;
}>();

const smBreakpoint = 640;

const shown = ref<boolean>(props.initShown);
function show(s = !shown.value) {
  if (modalComp.value?.shown != s && width.value <= smBreakpoint) modalComp.value?.show(s);
  if (s === shown.value) return;
  shown.value = s;
  emit("update:shown", s);
}

defineExpose({
  show,
  shown,
});

const width = ref<number>(window.innerWidth);
let modalCompNeedUpdate = false;
addEventListener("resize", () => {
  if (width.value > smBreakpoint === window.innerWidth <= smBreakpoint) modalCompNeedUpdate = true;
  width.value = window.innerWidth;
});

onUpdated(() => {
  if (modalCompNeedUpdate) modalComp.value?.show(shown.value);
});
</script>

<template>
  <div v-if="width > smBreakpoint">
    <div ref="accordion"
      class="flex overflow-hidden transition-all duration-500 max-w-0 max-h-fit mx-2 my-2 whitespace-nowrap bg-slate-300 rounded-lg"
      :class="{ 'max-w-full': shown }">
      <div class="flex flex-col m-2">
        <div class="inline-block">
          <!-- mb-1 -->
          <span class="mr-2">Incertitudes</span>
          <span class="align-middle p-1 px-2 bg-slate-200 rounded-md">
            <input v-model="settings.uncertainty" type="checkbox" @input="$emit('update:modelValue', settings)" />
          </span>
        </div>
      </div>
    </div>
  </div>
  <BaseModal v-else ref="modalComp" @update:shown="
    (s) => {
      if (s != shown) show();
    }
  ">
    <template #title>
      <h1 class="text-2xl text-center">Paramètres</h1>
    </template>
    <template #content>
      <div class="bg-slate-300 p-2 rounded-lg w-fit">
        <span class="mr-2">Incertitudes</span>
        <span class="align-middle p-1 px-2 bg-slate-200 rounded-md">
          <input v-model="settings.uncertainty" type="checkbox" @input="$emit('update:modelValue', settings)" />
        </span>
      </div>
    </template>
  </BaseModal>
</template>
