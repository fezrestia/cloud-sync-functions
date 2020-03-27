const functions = require("firebase-functions");
import { Request, EventContext } from "firebase-functions";

import * as express from "express";

const puppeteer = require("puppeteer");
import { Browser, Page, ElementHandle } from "puppeteer";

const https = require("https");
import { IncomingMessage } from "http";

const runtimeConfig: { timeoutSeconds: number, memory: "128MB"|"256MB"|"512MB"|"1GB"|"2GB" } = {
  timeoutSeconds: 300,
  memory: "512MB"
};

const TARGET_REGION = "asia-northeast1";
const TARGET_TZ = "Asia/Tokyo";

export const checkStatus = functions
    .runWith(runtimeConfig)
    .https
    .onRequest( (request, response) => {
  response.send("OK");
});



//// DCM SIM STATS ////////////////////////////////////////////////////////////////////////////////
//
//

const DCM_VALID_URL_PATTERN = "docomo";

const DCM_HOST_URL = "https://www.nttdocomo.co.jp";
const DCM_TOP_URL = `${DCM_HOST_URL}/mydocomo/data`;
const DCM_LOGIN_URL = `${DCM_HOST_URL}/auth/cgi`;

const DCM_FIREBASE_DB_ROOT = "https://cloud-sync-service.firebaseio.com/dcm-sim-usage/logs";

const DCM_CRON = "5 */3 * * *"; // min hour day month weekday

// Manual trigger from HTTPS.
export const httpsUpdateDcmStats = functions
    .runWith(runtimeConfig)
    .region(TARGET_REGION)
    .https
    .onRequest( async (request: Request, response: express.Response) => {
      console.log("## httpsUpdateDcmStatus() : E");

      await doUpdateDcmStats( (resMsg: string) => {
        response.send(resMsg);
      } );

      console.log("## httpsUpdateDcmStatus() : X");
    } );

// Auto trigger from scheduler.
export const cronUpdateDcmStats = functions
    .runWith(runtimeConfig)
    .region(TARGET_REGION)
    .pubsub
    .schedule(DCM_CRON)
    .timeZone(TARGET_TZ)
    .onRun( async (context: EventContext) => {
      console.log("## cronUpdateDcmStatus() : E");

      await doUpdateDcmStats( (resMsg: string) => {
        resMsg.replace(/\n/g, ", ");
        console.log(`## ${resMsg}`);
      } );

      console.log("## cronUpdateDcmStatus() : X");
    } );

async function doUpdateDcmStats(onDone: (resMsg: string) => void) {
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
    const todayData: number = Number(monthUsed) * 1000;
    const yesterdayData: number = Number(yesterdayUsed) * 1000;

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

///////////////////////////////////////////////////////////////////////////////////////////////////



//// UTIL FUNCTIONS ///////////////////////////////////////////////////////////////////////////////
//
//

async function genBrowser(): Promise<Browser> {
  const chromeArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-zygote",
    "--single-process",
    "--incognito",
  ];

  const browser = await puppeteer.launch( {
    args: chromeArgs,
    headless: true,
  } );

  return browser;
}

async function genPage(browser: Browser, validUrlPattern: string): Promise<Page> {
  const page = await browser.newPage();

  // Timeout = 1 min.
  page.setDefaultTimeout(60000);

  // Filter out unnecessary request.
  await page.setRequestInterception(true);
  page.on("request", async (interceptedRequest) => {
    const targetUrl = interceptedRequest.url();

    const isInvalidUrl = !targetUrl.includes(validUrlPattern);
    const isPng = targetUrl.endsWith(".png");
    const isJpg = targetUrl.endsWith(".jpg");
    const isGif = targetUrl.endsWith(".gif");

    if (isInvalidUrl || isPng || isJpg || isGif) {
      await interceptedRequest.abort();
    } else {
      await interceptedRequest.continue();
    }
  } );

  return page;
}

function genJstDate(): Date {
  const nowUtcMillis = Date.now();
  const offsetMillis = new Date().getTimezoneOffset() * 60 * 1000; // UTC - Local
  const nowJstMillis = nowUtcMillis + offsetMillis + (9 * 60 * 60 * 1000); // +0900
  const nowJst = new Date(nowJstMillis);
  return nowJst;
}

function genDatePath(date: Date): string {
  return `y${date.getFullYear()}/m${date.getMonth() + 1}/d${date.getDate()}`;
}

async function asyncPutHttps(url: string, json: any): Promise<string> {
  return new Promise<string>( (resolve: (string) => void) => {
    const options = {
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
    };

    const req = https.request(
        url,
        options,
        (res: IncomingMessage) => {
          res.setEncoding("utf8");

          res.on("data", (chunk: string|Buffer) => {
            // NOP.
            console.log(`## https.res.on.data() : ${chunk.toString()}`);
          } );

          res.on("aborted", () => {
            console.log("## https.res.on.aborted()");
            resolve("ERROR : Response Aborted.");
          } );

          res.on("end", () => {
            console.log("## https.res.on.end()");
            resolve("OK");
          } );

        } );

    req.on("error", (e: Error) => {
      console.log("## https.req.on.error()");
      resolve(`ERROR : Exception=${e.toString()}`);
    } );

    req.write(JSON.stringify(json));
    req.end();
  } );
}

///////////////////////////////////////////////////////////////////////////////////////////////////

