<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <RouterView />
</template>

<style>
@tailwind base;

@layer base {
  /* Width */
  ::-webkit-scrollbar {
    width: 10px;
  }

  /* Track */
  ::-webkit-scrollbar-track {
    @apply bg-gray-200;
  }

  /* Handle */
  ::-webkit-scrollbar-thumb {
    @apply bg-gray-400;
    @apply rounded-md;
  }

  /* Handle on hover */
  ::-webkit-scrollbar-thumb:hover {
    @apply bg-gray-500;
  }
}
</style>
