import { Preferences } from "@capacitor/preferences";
import { ref } from "vue";
import type { StopArea, StopPoint } from "./TBM";

const preferencesKeys = {
  settings: "settings",
  location: "location",
  paused: "paused",
};

interface Settings {
  uncertainty: boolean;
  dates: boolean;
  delay: boolean;
  schedules: boolean;
}

const defaultSettings: Settings = {
  uncertainty: false,
  dates: false,
  delay: false,
  schedules: false,
};

const settings = ref<Settings>({ ...defaultSettings });

function updateStoredSettings() {
  setTimeout(() => {
    Preferences.set({ key: preferencesKeys.settings, value: JSON.stringify(settings.value) });
  }, 50);
}

async function fetchSettings() {
  const { value } = await Preferences.get({ key: preferencesKeys.settings });
  if (value) {
    settings.value = JSON.parse(value);
    return true;
  }

  return false;
}

const paused = ref<(StopPoint["id"] | StopArea["id"])[]>([]);

function updateStoredPaused() {
  setTimeout(() => {
    Preferences.set({ key: preferencesKeys.paused, value: JSON.stringify(paused.value) });
  }, 50);
}

async function fetchPaused() {
  const { value } = await Preferences.get({ key: preferencesKeys.paused });
  if (value) {
    paused.value = JSON.parse(value);
    return true;
  }

  return false;
}

export {
  defaultSettings,
  preferencesKeys,
  settings,
  updateStoredSettings,
  fetchSettings,
  paused,
  updateStoredPaused,
  fetchPaused,
};

export type { Settings };
