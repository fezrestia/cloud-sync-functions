import functions = require("firebase-functions");
import { Browser, Page, ElementHandle, JSHandle } from "puppeteer";
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

const DCM_INVALID_USED_MB = -1;

const DCM_FIREBASE_DB_PATH = "dcm-sim-usage/logs";
export const DCM_FIREBASE_DB_ROOT = `https://cloud-sync-service.firebaseio.com/${DCM_FIREBASE_DB_PATH}`;

/**
 * Sync from DCM web and update Firebase DB.
 *
 * @param onDone Callback function
 */
export async function doUpdateDcmStats(onDone: (resJson: string) => void) {
  try {
    console.log("DCM: doUpdateDcmStats() : E");

    const browser = await genBrowser();
    const page = await genPage(browser, DCM_VALID_URL_PATTERN);

    // Top page.
    await page.goto(DCM_TOP_URL, { waitUntil: "networkidle0" });
    console.log("DCM: Open top page : DONE");

    // Search login URL.
    const loginSelector = "div#mydcm_footer_login_btn a.mydcm_login_normal";
    const login: ElementHandle|null = await page.$(loginSelector);
    if (login === null) {
      onDone(`{"error": "No Login Link Detected."}`);
      return;
    }
    console.log("DCM: Search Login Link : DONE");

    // Go to Login page.
    await login.click();
    await page.waitForNavigation();
    console.log("DCM: Click Login Link : DONE");

    // Input ID.
    await page.type('input[id="Di_Uid"]', functions.config().dcm.id);
    console.log("DCM: Input UID : DONE");
    const idButton = await page.$("input.button_submit.nextaction") as ElementHandle;
    console.log("DCM: Search UID Submit Button : DONE");
    await idButton.click();
    console.log("DCM: Click UID Submit Button : DONE");
    await page.waitForNavigation();

    // Input Pass.
    await page.type('input[id="Di_Pass"]', functions.config().dcm.pass);
    console.log("DCM: Input Pass : DONE");
    const passButton = await page.$("input.button_submit.nextaction") as ElementHandle;
    console.log("DCM: Search Pass Submit Button : DONE");
    await passButton.click();
    console.log("DCM: Click Pass Submit Button : DONE");
    await page.waitForNavigation();

    // Wait for contents rendering.
    await page.waitForSelector("section#mydcm_data_3day");
    console.log("DCM: Wait for 3 Days Data : DONE");
    await page.waitForSelector("section#mydcm_data_month");
    console.log("DCM: Wait for Month Data : DONE");

    // Parse day used.
    let yesterdayUsed: string = "";
    let yesterdayUsedMb: number = DCM_INVALID_USED_MB;
    const yesterdayUsedSelector = [
        "p#mydcm_data_3day-02_graph",
        "svg",
        "g.bottom-bar-val",
        "g.tick:nth-of-type(2)",
        "text",
    ];
    const dayUsedElm: ElementHandle|null = await page.$(yesterdayUsedSelector.join(" "));
    if (dayUsedElm === null) {
      onDone(`{"error": "No day used element found."}`);
    } else {
      const text = await dayUsedElm.getProperty("textContent") as ElementHandle;
      yesterdayUsed = await text.jsonValue();
      yesterdayUsedMb = Math.round(parseFloat(yesterdayUsed) * 1000); // Convert GB -> MB
      console.log(`DCM: yesterdayUsedMb = ${yesterdayUsedMb}`);
    }
    console.log("DCM: Parse yesterdayUsedMb : DONE");

    // Parse month used current.
    let monthUsed: string = "";
    let monthUsedMb: number = DCM_INVALID_USED_MB;
    const monthUsedSelector = [
        "div#mydcm_data_month-03",
        "dl:first-of-type",
        "dd",
        "p",
        "span.latest-area-foma-monthly-gb-value",
    ];
    const monthUsedElm: ElementHandle|null = await page.$(monthUsedSelector.join(" "));
    if (monthUsedElm === null) {
      onDone(`{"error": "No month used element found."}`);
    } else {
      const text = await monthUsedElm.getProperty("textContent") as ElementHandle;
      monthUsed = await text.jsonValue();
      monthUsedMb = Math.round(parseFloat(monthUsed) * 1000); // Convert GB -> MB
      console.log(`DCM: monthUsedMb = ${monthUsedMb}`);
    }
    console.log("DCM: Parse monthUsedMb : DONE");

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

    console.log("DCM: doUpdateDcmStats() : X");
    return;
  } catch(e) {
    onDone(genErrorMsg(e.toString()));

    console.log("DCM: doUpdateDcmStats() : X");
    return;
  }
}

