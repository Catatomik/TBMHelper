<script setup lang="ts">
import { settings, fetchSettings, type Settings } from "@/store/Storage";
import { onUpdated, ref } from "vue";
import BaseModal from "@/components/BaseModal.vue";

const modalComp = ref<InstanceType<typeof BaseModal> | null>(null);

interface Props {
  initShown?: boolean;
  modelValue: Settings;
}
const props = withDefaults(defineProps<Props>(), { initShown: false });

const emit = defineEmits<{
  "update:shown": [shown: boolean];
  "update:modelValue": [settings: Settings];
}>();

fetchSettings().then((r) => {
  if (r) emit("update:modelValue", settings.value);
});

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
    <div
      ref="accordion"
      class="flex overflow-hidden transition-all duration-500 max-w-0 max-h-fit mx-2 my-2 whitespace-nowrap bg-slate-300 rounded-lg"
      :class="{ 'max-w-full': shown, 'h-0': !shown }"
    >
      <div class="m-2">
        <div class="flex flex-col">
          <div class="flex items-center">
            <p class="mr-2">Incertitudes</p>
            <span class="flex items-center p-1 bg-slate-200 rounded-md">
              <input
                v-model="settings.uncertainty"
                type="checkbox"
                @input="emit('update:modelValue', settings)"
              />
            </span>
          </div>
          <div class="flex items-center mt-1">
            <p class="mr-2">Affichage des dates</p>
            <span class="flex items-center p-1 bg-slate-200 rounded-md">
              <input v-model="settings.dates" type="checkbox" @input="emit('update:modelValue', settings)" />
            </span>
          </div>
          <div class="flex items-center mt-1">
            <p class="mr-2">Affichage du retard</p>
            <span class="flex items-center p-1 bg-slate-200 rounded-md">
              <input v-model="settings.delay" type="checkbox" @input="emit('update:modelValue', settings)" />
            </span>
          </div>
          <div class="flex items-center mt-1">
            <p class="mr-2">Horaires prévisionnels</p>
            <span class="flex items-center p-1 bg-slate-200 rounded-md">
              <input
                v-model="settings.schedules"
                type="checkbox"
                @input="emit('update:modelValue', settings)"
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <BaseModal
    v-else
    ref="modalComp"
    @update:shown="
      (s) => {
        if (s != shown) show();
      }
    "
  >
    <template #title>
      <h1 class="text-2xl text-center">Paramètres</h1>
    </template>
    <template #content>
      <div class="flex flex-col px-2">
        <div class="flex items-center">
          <p class="mr-2">Incertitudes</p>
          <span class="flex items-center p-1 bg-slate-200 rounded-md">
            <input
              v-model="settings.uncertainty"
              type="checkbox"
              @input="emit('update:modelValue', settings)"
            />
          </span>
        </div>
        <div class="flex items-center mt-1">
          <p class="mr-2">Affichage des dates</p>
          <span class="flex items-center p-1 bg-slate-200 rounded-md">
            <input v-model="settings.dates" type="checkbox" @input="emit('update:modelValue', settings)" />
          </span>
        </div>
        <div class="flex items-center mt-1">
          <p class="mr-2">Affichage du retard</p>
          <span class="flex items-center p-1 bg-slate-200 rounded-md">
            <input v-model="settings.delay" type="checkbox" @input="emit('update:modelValue', settings)" />
          </span>
        </div>
        <div class="flex items-center mt-1">
          <p class="mr-2">Horaires prévisionnels</p>
          <span class="flex items-center p-1 bg-slate-200 rounded-md">
            <input
              v-model="settings.schedules"
              type="checkbox"
              @input="emit('update:modelValue', settings)"
            />
          </span>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
