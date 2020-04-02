import { genTodayDatePath, genYesterdayDatePath } from "../util";
import { asyncGetHttps } from "../web_driver";
import { DCM_FIREBASE_DB_ROOT } from "./dcm_stats";
import { NURO_FIREBASE_DB_ROOT } from "./nuro_stats";
import { ZEROSIM_FIREBASE_DB_ROOT } from "./zerosim_stats";

/**
 * Get latest SIM stats.
 *
 * @param onDone Callback function
 */
export async function getLatestSimStats(onDone: (json: object) => void) {
  try {
    const todayDatePath: string = genTodayDatePath();
    const yesterdayDatePath: string = genYesterdayDatePath();

    // DCM.
    let dcmMonthUsed = await getMonthUsed(DCM_FIREBASE_DB_ROOT, todayDatePath);
    if (dcmMonthUsed < 0) {
      dcmMonthUsed = await getMonthUsed(DCM_FIREBASE_DB_ROOT, yesterdayDatePath);
    }

    // Nuro.
    let nuroMonthUsed = await getMonthUsed(NURO_FIREBASE_DB_ROOT, todayDatePath);
    if (nuroMonthUsed < 0) {
      nuroMonthUsed = await getMonthUsed(NURO_FIREBASE_DB_ROOT, yesterdayDatePath);
    }

    // ZeroSim.
    let zeroSimMonthUsed = await getMonthUsed(ZEROSIM_FIREBASE_DB_ROOT, todayDatePath);
    if (zeroSimMonthUsed < 0) {
      zeroSimMonthUsed = await getMonthUsed(ZEROSIM_FIREBASE_DB_ROOT, yesterdayDatePath);
    }

    // Return JSON.
    const json: object = {
      month_used_dcm: dcmMonthUsed,
      month_used_nuro: nuroMonthUsed,
      month_used_zero_sim: zeroSimMonthUsed,
    };

    onDone(json);
    return;
  } catch(e) {
    const errorJson: object = {
      error: e.toString(),
    };
    onDone(errorJson);
    return;
  }
}

// positive number = used amount [MB]
// negative number = error
async function getMonthUsed(rootUrl: string, datePath: string): Promise<number> {
  const url = `${rootUrl}/${datePath}/month_used_current.json`

  const rawData: string|null = await asyncGetHttps(url);

  if (rawData === null) {
    console.log(`ERROR: Failed to get month used on ${url}`);
    return -1;
  }

  if (rawData === "null") {
    // Data is not available yet. Maybe just after date change.
    return -1;
  }

  return parseInt(rawData);
}

