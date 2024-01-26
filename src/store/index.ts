import { ref } from "vue";

enum FetchStatus {
  Errored = 0,
  Fetching = 1,
  Fetched = 2,
}

/**
 * @param ms Une durée en secondes
 * @param includeSec Un booléen indiquant s'il faut inclure les secondes
 * @returns La durée formatée (YY?, MoMo?, DD?, HH?, MiMi?, SS? )
 */
function duration(ms: number, includeSec = true, short = false): string {
  ms = Math.abs(ms);

  const y = Math.floor(ms / 31556952000);
  ms -= y * 31556952000;
  const sy = y > 1 ? "s" : "";
  const mo = Math.floor(ms / 2629746000);
  ms -= mo * 2629746000;
  const d = Math.floor(ms / (3600000 * 24));
  ms -= d * 3600000 * 24;
  const sd = d > 1 ? "s" : "";
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const sh = h > 1 ? "s" : "";
  const mi = Math.floor(ms / 60000);
  ms -= mi * 60000;
  const smi = mi > 1 ? "s" : "";
  const s = Math.floor(ms / 1000);
  const ss = s > 1 ? "s" : "";

  return `${y > 0 && y < Infinity ? `${y}${short ? "a" : ` an${sy}`} ` : ""}${
    mo > 0 ? `${mo}${short ? "mo" : ` mois`} ` : ""
  }${d > 0 ? `${d}${short ? "j" : ` jour${sd}`} ` : ""}${h > 0 ? `${h}${short ? "h" : ` heure${sh}`} ` : ""}${
    mi > 0 ? `${mi}${short ? ` min${smi}` : ` minute${smi}`} ` : ""
  }${s > 0 && includeSec ? `${s}${short ? "s" : ` seconde${ss}`}` : ""}`.replace(/ $/g, "");
}

/**
 * @description Checks unicity of a value in an array
 */
function unique<T>(v: T, i: number, arr: T[]): boolean {
  return arr.indexOf(v) === i;
}

function getNewTopZIndex() {
  let max = 0;
  for (const el of document.querySelectorAll("body *")) {
    const zindex = parseInt(window.getComputedStyle(el).zIndex);
    if (zindex > max) max = zindex;
  }
  return max + 1;
}

function dateCompact(date: string | number | Date) {
  if (!(date instanceof Date)) date = new Date(date);
  const deltaD = date.getDate() - new Date().getDate();
  let h: number | string = date.getHours();
  let m: number | string = date.getMinutes();
  let s: number | string = date.getSeconds();

  if (h < 10) h = "0" + h;
  if (m < 10) m = "0" + m;
  if (s < 10) s = "0" + s;
  return `${
    deltaD > 0 ? (deltaD === 1 ? "demain, " : deltaD === 2 ? "après-demain, " : `dans ${deltaD} jours, `) : ""
  }${h}:${m}:${s}`;
}

interface DeserializedURL {
  hash: string | undefined;
  query: Record<string, string>;
  path: string;
}

function deserializeURL(url: string): DeserializedURL {
  url = decodeURI(url);

  const splittedHash = url.split("#");
  const splittedQuery = splittedHash[0].split("?");
  const query: DeserializedURL["query"] = {};
  if (splittedQuery.length > 1) {
    for (const entry of splittedQuery[1].split("&")) {
      const pair = entry.split("=");
      if (pair.length < 2) continue;
      query[pair[0]] = pair[1].replace(/\+/g, " ");
    }
  }

  return {
    hash: splittedHash[1],
    query,
    path: splittedQuery[0],
  };
}

const now = ref<number>(Date.now());
setInterval(() => {
  now.value = Date.now();
}, 1000);

async function mapAsync<I, O>(
  array: I[],
  callback: (value: I, index: number, array: I[]) => Promise<O>,
): Promise<O[]> {
  return await Promise.all(array.map(callback));
}

export { FetchStatus, duration, unique, getNewTopZIndex, dateCompact, deserializeURL, now, mapAsync };
