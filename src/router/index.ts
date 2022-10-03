/// <reference types="vite/client" />

import { createRouter, createWebHistory } from "vue-router";
import BaseView from "../views/BaseView.vue";

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

export default router;
