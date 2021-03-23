import functions = require("firebase-functions");
import { Browser, Page, ElementHandle } from "puppeteer";
import {
    genTodayDatePath,
    genYesterdayDatePath,
    parseTextFromSelector,
    genResMsg,
    genErrorMsg } from "../util";
import { genBrowser, genPage, asyncUpdateFirebaseDatabase } from "../web_driver";

const DCM_VALID_URL_PATTERN = "docomo";
const DCM_HOST_URL = "https://www.nttdocomo.co.jp";
const DCM_TOP_URL = `${DCM_HOST_URL}/mydocomo/data`;
const DCM_LOGIN_URL = `${DCM_HOST_URL}/auth/cgi`;
const DCM_LOGIN_URL_INCLUDE = `${DCM_HOST_URL}/mydocomo`;
const DCM_3DAY_DETAIL_URL = "https://www.mydocomo.com/dcm/dfw/bis/guide/charges/gkyap001.srv";
const DCM_MONTH_DETAIL_URL = "https://www.mydocomo.com/dcm/dfw/bis/guide/charges/gkyap001.srv?Xitraffic=1";

const DCM_FIREBASE_DB_PATH = "dcm-sim-usage/logs";
export const DCM_FIREBASE_DB_ROOT = `https://cloud-sync-service.firebaseio.com/${DCM_FIREBASE_DB_PATH}`;

/**
 * Sync from DCM web and update Firebase DB.
 *
 * @param onDone Callback function
 */
export async function doUpdateDcmStats(onDone: (resJson: string) => void) {
  try {
    const browser = await genBrowser();
    const page = await genPage(browser, DCM_VALID_URL_PATTERN);

    // Top page.
    await page.goto(DCM_TOP_URL, { waitUntil: "networkidle0" });

    // Search login URL.
    const links: ElementHandle[] = await page.$$("a");
    let loginLink: ElementHandle|null = null;
    let loginUrl: string|null = null;
    for (const link of links) {
      if (link === null) continue;

      const prop = await link.getProperty("href");
      const json = await prop.jsonValue() as object;
      const url = decodeURIComponent(json.toString());

      if (url.startsWith(DCM_LOGIN_URL) && url.includes(DCM_LOGIN_URL_INCLUDE)) {
        if (loginLink !== null && loginUrl !== url) {
          onDone(`{"error": "Over 2 Login Links Detected."}`);
          return;
        }
        loginLink = link;
        loginUrl = url;
      }
    }
    if (loginLink === null) {
      onDone(`{"error": "No Login Link Detected."}`);
      return;
    }

    // Go to Login page.
    await loginLink.click();
    await page.waitForNavigation();

    // Input ID.
    await page.type('input[id="Di_Uid"]', functions.config().dcm.id);
    const idButton = await page.$("input.button_submit.nextaction") as ElementHandle;
    await idButton.click();
    await page.waitForNavigation();

    // Input Pass.
    await page.type('input[id="Di_Pass"]', functions.config().dcm.pass);
    const passButton = await page.$("input.button_submit.nextaction") as ElementHandle;
    await passButton.click();
    await page.waitForNavigation();

    // Wait for contents rendering.
    await page.waitForSelector("section#mydcm_data_3day");
    await page.waitForSelector("section#mydcm_data_month");

    // Go to 3-day detail page.
    await page.goto(DCM_3DAY_DETAIL_URL, { waitUntil: "networkidle0" });
    await page.waitForSelector("div#content");

    // Parse yesterday used.
    const yesterdayUsedSelector = "div#content table.charge-data01 tbody tr:nth-child(3) td:nth-child(2) tr td:nth-child(1) span";
    let yesterdayUsed: string = await parseTextFromSelector(page, yesterdayUsedSelector);
    yesterdayUsed = yesterdayUsed.replace(/,/g, "");
    yesterdayUsed = yesterdayUsed.replace("KB", "");
    const yesterdayUsedMb: number = Math.round(parseInt(yesterdayUsed) / 1000); // Convert KB to MB.

    // Go to month detail page.
    await page.goto(DCM_MONTH_DETAIL_URL, { waitUntil: "networkidle0" });
    await page.waitForSelector("div#content");

    // Parse month used.
    const monthUsedSelector = "div#content table.charge-data01 tbody tr:nth-child(2) td:nth-child(2) tr td:nth-child(2) p";
    let monthUsed: string = await parseTextFromSelector(page, monthUsedSelector);
    monthUsed = monthUsed.replace(/,/g, "");
    monthUsed = monthUsed.replace("(", "");
    monthUsed = monthUsed.replace(")", "");
    const monthUsedMb: number = Math.round(parseInt(monthUsed) / 1000); // Convert KB to MB.

    await browser.close();

    // Firebase DB path.
    const todayPath = `${DCM_FIREBASE_DB_PATH}/${genTodayDatePath()}`;
    const yesterdayPath = `${DCM_FIREBASE_DB_PATH}/${genYesterdayDatePath()}`;

    // Store data. [MB]
    const todayData = {
      month_used_current: monthUsedMb,
    };
    const yesterdayData = {
      day_used: yesterdayUsedMb,
    };

    // Update Firebase Database.
    const isTodayOk = await asyncUpdateFirebaseDatabase(todayPath, todayData);
    const isYesterdayOk = await asyncUpdateFirebaseDatabase(yesterdayPath, yesterdayData);

    // Response msg.
    const resJson = genResMsg(
        monthUsed,
        yesterdayUsed,
        todayPath,
        yesterdayPath,
        todayData.month_used_current,
        yesterdayData.day_used,
        isTodayOk ? "OK" : "NG",
        isYesterdayOk ? "OK" : "NG");

    onDone(resJson);
    return;
  } catch(e) {
    onDone(genErrorMsg(e.toString()));
    return;
  }
}

