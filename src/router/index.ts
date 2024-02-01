/// <reference types="vite/client" />

import { createRouter, createWebHistory } from "vue-router";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import BaseView from "../views/BaseView.vue";
import { deserializeURL } from "@/store";
import { preferencesKeys } from "@/store/Storage";

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
    } catch {
      return true;
    }

  try {
    await Preferences.set({ key: preferencesKeys.location, value: to.fullPath });
  } catch {}
});

App.addListener("appUrlOpen", function (event: URLOpenListenerEvent) {
  const slug = event.url.split("tbmhelper.catadev.org").pop();

  if (!slug) return;

  router.push({
    ...deserializeURL(slug),
  });
});

export default router;
