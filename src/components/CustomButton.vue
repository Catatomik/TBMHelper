<script setup lang="ts">
import { Button } from "@/store/Buttons";
import { ref } from "vue";

interface Props {
  button: Button;
  borderColor: string;
  fillColor: string;
}

const buttonRef = ref<HTMLButtonElement | null>(null);

defineProps<Props>();
</script>

<template>
  <button
    ref="buttonRef"
    class="border-2 rounded-md text-center select-none active:scale-110 duration-100"
    :class="[borderColor]"
  >
    <svg
      v-if="button == Button.Close"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="31.191 95.338 321.618 321.323"
      class="w-[.75em] aspect-square m-1"
      :class="[fillColor]"
    >
      <!--! Font Awesome Pro 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
      <path
        d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"
      />
    </svg>
    <svg
      v-else-if="button == Button.Refresh"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      class="w-[.75em] aspect-square m-1"
      :class="[fillColor]"
    >
      <!--! Font Awesome Pro 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
      <path
        d="M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0L386.3 160H352c-17.7 0-32 14.3-32 32s14.3 32 32 32H463.5c0 0 0 0 0 0h.4c17.7 0 32-14.3 32-32V80c0-17.7-14.3-32-32-32s-32 14.3-32 32v35.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2c-4 4-6.7 8.8-8.1 14c-.3 1.2-.6 2.5-.8 3.8c-.3 1.7-.4 3.4-.4 5.1V432c0 17.7 14.3 32 32 32s32-14.3 32-32V396.9l17.6 17.5 0 0c87.5 87.4 229.3 87.4 316.7 0c24.4-24.4 42.1-53.1 52.9-83.7c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0l-.1-.1L125.6 352H160c17.7 0 32-14.3 32-32s-14.3-32-32-32H48.4c-1.6 0-3.2 .1-4.8 .3s-3.1 .5-4.6 1z"
      />
    </svg>

    <svg
      v-else-if="button == Button.Add"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="14.712 46.492 418.575 418.428"
      class="w-[.75em] aspect-square m-1"
      :class="[fillColor]"
    >
      <!--! Font Awesome Pro 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
      <path
        d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"
      />
    </svg>
    <svg
      v-else-if="button == Button.Play"
      viewBox="0 31.9423 384 448.0792"
      xmlns="http://www.w3.org/2000/svg"
      class="w-[.75em] aspect-square m-1"
      :class="[fillColor]"
    >
      <path
        d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"
        transform="matrix(1, 0, 0, 1, 0, -7.105427357601002e-15)"
      />
    </svg>
    <svg
      v-else-if="button == Button.Pause"
      viewBox="0 64 320 384"
      xmlns="http://www.w3.org/2000/svg"
      class="w-[.75em] aspect-square m-1"
      :class="[fillColor]"
    >
      <path
        d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"
        transform="matrix(1, 0, 0, 1, 0, -7.105427357601002e-15)"
      />
    </svg>
  </button>
</template>
