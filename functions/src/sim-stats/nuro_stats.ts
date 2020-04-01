const functions = require("firebase-functions");
import { Browser, Page, ElementHandle } from "puppeteer";
import {
    genTodayDatePath,
    genYesterdayDatePath,
    parseTextFromSelector,
    genResMsg,
    genErrorMsg } from "../util";
import { genBrowser, genPage, asyncPutHttps } from "../web_driver";

const NURO_VALID_URL_PATTERN = "nuro";
const NURO_LOGIN_URL = "https://mobile.nuro.jp/mobile_contract/u/login/";
export const NURO_FIREBASE_DB_ROOT = "https://cloud-sync-service.firebaseio.com/nuro-sim-usage/logs";

/**
 * Sync from Nuro web and update Firebase DB.
 *
 * @param onDone Callback function
 */
export async function doUpdateNuroStats(onDone: (resJson: string) => void) {
  try {
    const browser = await genBrowser();
    const page = await genPage(browser, NURO_VALID_URL_PATTERN);

    // Login page.
    await page.goto(NURO_LOGIN_URL, { waitUntil: "networkidle0" });

    // Login.
    await page.type("input#simNumber", functions.config().nuro.id);
    await page.type("input#simPassword", functions.config().nuro.pass);
    const loginButton = await page.$("input#simSubmit") as ElementHandle;
    await loginButton.click();
    await page.waitForNavigation();

    // Wait for content loaded.
    const monthUsedSelector = "div#main div.container section div.indexBox div.float div.block.right.zyokyo ul.zyokyoBlock li ul li p.data span.yen";
    await page.waitForSelector(monthUsedSelector);
    const yesterdayUsedSelector = "div#main div.container section div.indexBox div.float div.block.right.zyokyo ul.zyokyoBlock li:nth-of-type(2) div.siyou:nth-of-type(2) p.data span.yen";
    await page.waitForSelector(yesterdayUsedSelector);

    // Get month used data.
    const monthUsed: string = await parseTextFromSelector(page, monthUsedSelector);

    // Get yesterday used data.
    const yesterdayUsed: string = await parseTextFromSelector(page, yesterdayUsedSelector);

    // Firebase DB target URL.
    const todayUrl = `${NURO_FIREBASE_DB_ROOT}/${genTodayDatePath()}/month_used_current.json`;
    const yesterdayUrl = `${NURO_FIREBASE_DB_ROOT}/${genYesterdayDatePath()}/day_used.json`;

    // Store data. [MB]
    const todayData: number = parseInt(monthUsed) || 0;
    const yesterdayData: number = parseInt(yesterdayUsed) || 0;

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
    onDone(genErrorMsg(e.toString()));
    return;
  }
}

