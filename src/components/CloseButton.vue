<script setup lang="ts">
import { Button } from "@/store/Buttons";
import CustomButton from "./CustomButton.vue";

interface Props {
  borderColor?: string;
  fillColor?: string;
}

withDefaults(defineProps<Props>(), { borderColor: "border-red-500", fillColor: "fill-red-500" });
</script>

<template>
  <CustomButton :button="Button.Close" :border-color="borderColor" :fill-color="fillColor" />
</template>
