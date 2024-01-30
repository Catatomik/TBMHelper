import { Preferences } from "@capacitor/preferences";
import { ref } from "vue";
import type { StopArea, StopPoint } from "./TBM";
import { Deferred } from ".";

const preferencesKeys = {
  settings: "settings",
  location: "location",
  paused: "paused",
  minimized: "mini",
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
  const def = new Deferred<void>();

  setTimeout(async () => {
    def.resolve(await Preferences.set({ key: preferencesKeys.paused, value: JSON.stringify(paused.value) }));
  }, 50);

  return def.promise;
}

async function fetchPaused() {
  const { value } = await Preferences.get({ key: preferencesKeys.paused });
  if (value) {
    paused.value = JSON.parse(value);
    return true;
  }

  return false;
}

function setPaused(s: StopPoint["id"] | StopArea["id"]) {
  if (paused.value.length === paused.value.push(s)) return updateStoredPaused();
}

function setUnpaused(s: StopPoint["id"] | StopArea["id"]) {
  const len = paused.value.length;
  paused.value = paused.value.filter((p) => p !== s);
  if (len !== paused.value.length) return updateStoredPaused();
}

const minimized = ref<StopArea["id"][]>([]);

function updateStoredMinimized() {
  const def = new Deferred<void>();

  setTimeout(async () => {
    def.resolve(
      await Preferences.set({ key: preferencesKeys.minimized, value: JSON.stringify(minimized.value) }),
    );
  }, 50);

  return def.promise;
}

async function fetchMinimized() {
  const { value } = await Preferences.get({ key: preferencesKeys.minimized });
  if (value) {
    minimized.value = JSON.parse(value);
    return true;
  }

  return false;
}

function setMinimized(sa: StopArea["id"]) {
  if (minimized.value.length === minimized.value.push(sa)) return updateStoredMinimized();
}

function setUnminimized(sa: StopArea["id"]) {
  const len = minimized.value.length;
  minimized.value = minimized.value.filter((p) => p !== sa);
  if (len !== minimized.value.length) return updateStoredMinimized();
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
  setPaused,
  setUnpaused,
  minimized,
  updateStoredMinimized,
  fetchMinimized,
  setMinimized,
  setUnminimized,
};

export type { Settings };
