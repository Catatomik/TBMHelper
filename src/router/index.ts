/// <reference types="vite/client" />

import { createRouter, createWebHistory } from "vue-router";
import { Preferences } from "@capacitor/preferences";
import BaseView from "../views/BaseView.vue";
import { preferencesKeys } from "@/store";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "index",
      component: BaseView,
    },
  ],
});

router.beforeResolve(async (to, from) => {
  // Right after opening
  if (!Object.keys(from.query).length && !Object.keys(to.query).length)
    try {
      const { value } = await Preferences.get({ key: preferencesKeys.location });
      return value && value !== "/" ? value : true;
    } catch (_) {
      return true;
    }

  try {
    await Preferences.set({ key: preferencesKeys.location, value: to.fullPath });
  } catch (_) { }
});

export default router;
