import functions = require("firebase-functions");
import { Browser, Page, ElementHandle } from "puppeteer";
import {
    genTodayDatePath,
    genYesterdayDatePath,
    parseTextFromSelector,
    genResMsg,
    genErrorMsg } from "../util";
import { genBrowser, genPage, asyncUpdateFirebaseDatabase } from "../web_driver";

const ZEROSIM_VALID_URL_PATTERN = "so-net";
const ZEROSIM_LOGIN_URL = "https://www.so-net.ne.jp/retail/u/";
const ZEROSIM_FIREBASE_DB_PATH = "zero-sim-usage/logs";
export const ZEROSIM_FIREBASE_DB_ROOT = `https://cloud-sync-service.firebaseio.com/${ZEROSIM_FIREBASE_DB_PATH}`;

/**
 * Sync from ZeroSIM web and update Firebase DB.
 *
 * @param onDone Callback function
 */
export async function doUpdateZeroSimStats(onDone: (resJson: string) => void) {
  try {
    const browser = await genBrowser();
    const page = await genPage(browser, ZEROSIM_VALID_URL_PATTERN);

    // Login page.
    await page.goto(ZEROSIM_LOGIN_URL, { waitUntil: "networkidle0" });

    // Login.
    await page.type("input#simNumber", functions.config().zerosim.id);
    await page.type("input#simPassword", functions.config().zerosim.pass);
    const loginButton = await page.$("input#simSubmit") as ElementHandle;
    await loginButton.click();
    await page.waitForNavigation();

    // Wait for usage condition menu available.
    const usageMenuButtonSelector = `form[name="userUsageActionForm"] input#menuUseCondition`;
    await page.waitForSelector(usageMenuButtonSelector);

    // Usage data page.
    const usageMenuButton = await page.$(usageMenuButtonSelector) as ElementHandle;
    await usageMenuButton.click();
    await page.waitForNavigation();

    // Wait for month/day usage content loaded.
    const monthUsedSelector = "div.contents div.guideSignElem dl.useConditionDisplay dd:nth-of-type(1)";
    await page.waitForSelector(monthUsedSelector);
    const yesterdayUsedSelector = "div.contents div.guideSignElem dl.useConditionDisplay dd:nth-of-type(3)";
    await page.waitForSelector(yesterdayUsedSelector);

    // Get month used data.
    const monthUsedRaw: string = await parseTextFromSelector(page, monthUsedSelector);

    // Get yesterday used data.
    const yesterdayUsedRaw: string = await parseTextFromSelector(page, yesterdayUsedSelector);

    await browser.close();

    // Remove white-space and "MB".
    const monthUsed: string = monthUsedRaw.replace(/(\s|MB)/g, "");
    const yesterdayUsed: string = yesterdayUsedRaw.replace(/(\s|MB)/g, "");

    // Firebase DB path.
    const todayPath = `${ZEROSIM_FIREBASE_DB_PATH}/${genTodayDatePath()}`;
    const yesterdayPath = `${ZEROSIM_FIREBASE_DB_PATH}/${genYesterdayDatePath()}`;

    // Store data. [MB]
    const todayData = {
      month_used_current: parseInt(monthUsed) || 0,
    };
    const yesterdayData = {
      day_used: parseInt(yesterdayUsed) || 0,
    };

    // Update Firebase Database.
    const isTodayOk = await asyncUpdateFirebaseDatabase(todayPath, todayData);
    const isYesterdayOk = await asyncUpdateFirebaseDatabase(yesterdayPath, yesterdayData);

    // Response msg.
    const resJson: string = genResMsg(
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

