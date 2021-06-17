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
    console.log("DCM: Open top page : DONE");

    // Search login URL.
    const loginSelector = "div#mydcm_footer_login_btn a.mydcm_login_normal";
    const login = await page.$(loginSelector) as ElementHandle|null;
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

    // Go to 3-day detail page.
    await page.goto(DCM_3DAY_DETAIL_URL, { waitUntil: "networkidle0" });
    await page.waitForSelector("div#content");
    console.log("DCM: Wait for 3 Days Data Detail : DONE");

    // Parse yesterday used.
    const yesterdayUsedSelector = "div#content table.charge-data01 tbody tr:nth-child(3) td:nth-child(2) tr td:nth-child(1) span";
    let yesterdayUsed: string = await parseTextFromSelector(page, yesterdayUsedSelector);
    yesterdayUsed = yesterdayUsed.replace(/,/g, "");
    yesterdayUsed = yesterdayUsed.replace("KB", "");
    const yesterdayUsedMb: number = Math.round(parseInt(yesterdayUsed) / 1000); // Convert KB to MB.
    console.log("DCM: Parse 3 Days Data : DONE");

    // Go to month detail page.
    await page.goto(DCM_MONTH_DETAIL_URL, { waitUntil: "networkidle0" });
    await page.waitForSelector("div#content");
    console.log("DCM: Wait for Month Data Detail : DONE");

    // Parse month used.
    const monthUsedSelector = "div#content table.charge-data01 tbody tr:nth-child(2) td:nth-child(2) tr td:nth-child(2) p";
    let monthUsed: string = await parseTextFromSelector(page, monthUsedSelector);
    monthUsed = monthUsed.replace(/,/g, "");
    monthUsed = monthUsed.replace("(", "");
    monthUsed = monthUsed.replace(")", "");
    const monthUsedMb: number = Math.round(parseInt(monthUsed) / 1000); // Convert KB to MB.
    console.log("DCM: Parse Month Data : DONE");

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

