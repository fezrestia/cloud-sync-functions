const functions = require("firebase-functions");
import { Browser, Page, ElementHandle } from "puppeteer";
import { genJstDate, genDatePath } from "./util";
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
export async function doUpdateDcmStats(onDone: (resMsg: string) => void) {
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
    const monthElm = await page.$("section#mydcm_data_data div.in-data-use span.card-t-number");
    const monthProp = await monthElm.getProperty("textContent");
    const monthJson = await monthProp.jsonValue();
    const monthUsed: string = monthJson.toString();

    // Parse day data.
    const yesterdayElm = await page.$("section#mydcm_data_3day div#mydcm_data_3day-03 dl.mydcm_data_3day-03-02 span.card-t-ssnumber");
    const yesterdayProp = await yesterdayElm.getProperty("textContent");
    const yesterdayJson = await yesterdayProp.jsonValue();
    const yesterdayUsed: string = yesterdayJson.toString();

    await browser.close();

    // Firebase DB target path.
    const today = genJstDate();
    const yesterday = genJstDate();
    yesterday.setDate(today.getDate() - 1);
    const todayPath = genDatePath(today);
    const yesterdayPath = genDatePath(yesterday);
    const todayUrl = `${DCM_FIREBASE_DB_ROOT}/${todayPath}/month_used_current.json`;
    const yesterdayUrl = `${DCM_FIREBASE_DB_ROOT}/${yesterdayPath}/day_used.json`;

    // Store data. [MB]
    const todayData: number = Math.round(Number(monthUsed) * 1000);
    const yesterdayData: number = Math.round(Number(yesterdayUsed) * 1000);

    // Update Firebase DB.
    console.log("## PUT today data.");
    const todayRes = await asyncPutHttps(todayUrl, todayData);
    console.log("## PUT yesterday data.");
    const yesterdayRes = await asyncPutHttps(yesterdayUrl, yesterdayData);

    // Response msg.
    const resMsg = `
<pre>
monthUsed     = ${monthUsed}
yesterdayUsed = ${yesterdayUsed}

todayUrl      = ${todayUrl}
yesterdayUrl  = ${yesterdayUrl}

todayData     = ${JSON.stringify(todayData)}
yesterdayData = ${JSON.stringify(yesterdayData)}

todayRes      = ${todayRes}
yesterdayRes  = ${yesterdayRes}
</pre>
    `;

    onDone(resMsg);
    return;
  } catch(e) {
    onDone(`ERROR: ${e.toString()}`);
    return;
  }
}

