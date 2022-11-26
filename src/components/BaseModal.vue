<script setup lang="ts">
import { onMounted, onUpdated, ref } from "vue";
import { getNewTopZIndex } from "@/store";
import CloseButton from "./CloseButton.vue";

export interface Modal {
  bgColor?: string;
  initShown?: boolean;
}
const props = withDefaults(defineProps<Modal>(), { initShown: false, bgColor: "bg-slate-100" });

const emit = defineEmits<{
  (e: "update:shown", shown: boolean): void;
}>();

const focusDiv = ref<HTMLDivElement | null>(null);

const zIndex = ref<number>(-1);
onMounted(() => {
  zIndex.value = getNewTopZIndex();
});

const shown = ref<boolean>(props.initShown);

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
    <div class="m-auto w-fit duration-300 min-w-[66%]" @click="(e) => e.stopPropagation()">
      <div class="shadow-lg flex flex-col w-full rounded-md" :class="[bgColor]">
        <div class="flex flex-shrink-0 items-center justify-between py-4 px-2 mx-2 border-b">
          <slot name="title">a</slot>
          <CloseButton class="ml-2 hover:scale-[110%] duration-300 justify-self-end" @click="show(false)" />
        </div>
        <div class="relative p-4">
          <slot name="content">b</slot>
        </div>
      </div>
    </div>
  </div>
</template>
