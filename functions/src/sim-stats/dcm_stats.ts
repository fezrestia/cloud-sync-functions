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
    for (const link of links) {
      const prop = await link.getProperty("href");
      const json = await prop.jsonValue() as object;
      const url = decodeURIComponent(json.toString());

      if (url.startsWith(DCM_LOGIN_URL) && url.includes(DCM_TOP_URL)) {
        if (loginLink !== null) {
          onDone("ERROR: Over 2 Login Links Detected.");
          return;
        }
        loginLink = link;
      }
    }
    if (loginLink === null) {
      onDone("ERROR: No Login Link Detected.");
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
    await page.waitForSelector("section#mydcm_data_data");
    await page.waitForSelector("section#mydcm_data_3day");

    // Parse month data.
    const monthUsedSelector = "section#mydcm_data_data div.in-data-use span.card-t-number";
    const monthUsed: string = await parseTextFromSelector(page, monthUsedSelector);

    // Parse day data.
    const yesterdayUsedSelector = "section#mydcm_data_3day div#mydcm_data_3day-03 dl.mydcm_data_3day-03-02 span.card-t-ssnumber";
    const yesterdayUsed: string = await parseTextFromSelector(page, yesterdayUsedSelector);

    await browser.close();

    // Firebase DB path.
    const todayPath = `${DCM_FIREBASE_DB_PATH}/${genTodayDatePath()}`;
    const yesterdayPath = `${DCM_FIREBASE_DB_PATH}/${genYesterdayDatePath()}`;

    // Store data. [MB]
    const todayData = {
      month_used_current: Math.round( (parseFloat(monthUsed) || 0.0) * 1000 ),
    };
    const yesterdayData = {
      day_used: Math.round( (parseFloat(yesterdayUsed) || 0.0) * 1000 ),
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

