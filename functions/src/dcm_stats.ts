const functions = require("firebase-functions");
import { Browser, Page, ElementHandle } from "puppeteer";
import {
    genTodayDatePath,
    genYesterdayDatePath,
    parseTextFromSelector,
    genResMsg } from "./util";
import { genBrowser, genPage, asyncPutHttps } from "./web_driver";

const DCM_VALID_URL_PATTERN = "docomo";
const DCM_HOST_URL = "https://www.nttdocomo.co.jp";
const DCM_TOP_URL = `${DCM_HOST_URL}/mydocomo/data`;
const DCM_LOGIN_URL = `${DCM_HOST_URL}/auth/cgi`;
const DCM_FIREBASE_DB_ROOT = "https://cloud-sync-service.firebaseio.com/dcm-sim-usage/logs";

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
      const json = await prop.jsonValue();
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
    const idButton: ElementHandle = await page.$("input.button_submit.nextaction");
    await idButton.click();
    await page.waitForNavigation();

    // Input Pass.
    await page.type('input[id="Di_Pass"]', functions.config().dcm.pass);
    const passButton: ElementHandle = await page.$("input.button_submit.nextaction");
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

    // Firebase DB target path.
    const todayUrl = `${DCM_FIREBASE_DB_ROOT}/${genTodayDatePath()}/month_used_current.json`;
    const yesterdayUrl = `${DCM_FIREBASE_DB_ROOT}/${genYesterdayDatePath()}/day_used.json`;

    // Store data. [MB]
    let todayData: number = parseFloat(monthUsed) || 0.0;
    let yesterdayData: number = parseFloat(yesterdayUsed) || 0.0;
    todayData = Math.round(todayData * 1000);
    yesterdayData = Math.round(yesterdayData * 1000);

    // Update Firebase DB.
    const todayRes = await asyncPutHttps(todayUrl, todayData);
    const yesterdayRes = await asyncPutHttps(yesterdayUrl, yesterdayData);

    // Response msg.
    const resJson = genResMsg(
        monthUsed,
        yesterdayUsed,
        todayUrl,
        yesterdayUrl,
        todayData,
        yesterdayData,
        todayRes,
        yesterdayRes);

    onDone(resJson);
    return;
  } catch(e) {
    onDone(`{"error": "${e.toString()}"}`);
    return;
  }
}

