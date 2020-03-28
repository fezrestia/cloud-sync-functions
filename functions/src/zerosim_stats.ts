const functions = require("firebase-functions");
import { Browser, Page, ElementHandle } from "puppeteer";
import {
    genTodayDatePath,
    genYesterdayDatePath,
    parseTextFromSelector,
    genResMsg } from "./util";
import { genBrowser, genPage, asyncPutHttps } from "./web_driver";

const ZEROSIM_VALID_URL_PATTERN = "so-net";
const ZEROSIM_LOGIN_URL = "https://www.so-net.ne.jp/retail/u/";
const ZEROSIM_FIREBASE_DB_ROOT = "https://cloud-sync-service.firebaseio.com/zero-sim-usage/logs/";

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
    const loginButton: ElementHandle = await page.$("input#simSubmit");
    await loginButton.click();
    await page.waitForNavigation();

    // Wait for usage condition menu available.
    const usageMenuButtonSelector = `form[name="userUsageActionForm"] input#menuUseCondition`;
    await page.waitForSelector(usageMenuButtonSelector);

    // Usage data page.
    const usageMenuButton: ElementHandle = await page.$(usageMenuButtonSelector);
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

    // Remove white-space and "MB".
    const monthUsed: string = monthUsedRaw.replace(/(\s|MB)/g, "");
    const yesterdayUsed: string = yesterdayUsedRaw.replace(/(\s|MB)/g, "");

    // Firebase DB target URL.
    const todayUrl = `${ZEROSIM_FIREBASE_DB_ROOT}/${genTodayDatePath()}/month_used_current.json`;
    const yesterdayUrl = `${ZEROSIM_FIREBASE_DB_ROOT}/${genYesterdayDatePath()}/day_used.json`;

    // Store data. [MB]
    const todayData: number = parseInt(monthUsed);
    const yesterdayData: number =  parseInt(yesterdayUsed);

    // Update Firebase DB.
    const todayRes = await asyncPutHttps(todayUrl, todayData);
    const yesterdayRes = await asyncPutHttps(yesterdayUrl, yesterdayData);

    // Response msg.
    const resJson: string = genResMsg(
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
    onDone(`ERROR: ${e.toString()}`);
    return;
  }
}

