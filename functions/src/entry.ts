import * as functions from "firebase-functions";

const puppeteer = require("puppeteer");
import { ElementHandle } from "puppeteer";

const runtimeConfig: { timeoutSeconds: number, memory: "128MB"|"256MB"|"512MB"|"1GB"|"2GB" } = {
  timeoutSeconds: 300,
  memory: "512MB"
};

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

export const checkStatus = functions
    .runWith(runtimeConfig)
    .https
    .onRequest( (request, response) => {
  response.send("OK");
});



//// DCM SIM STATS ///////////////////////////////////////////////////////////////////////////////
//
//

const DCM_HOST_URL = "https://www.nttdocomo.co.jp"
const DCM_TOP_URL = `${DCM_HOST_URL}/mydocomo/data`;
const DCM_LOGIN_URL = `${DCM_HOST_URL}/auth/cgi`;

export const updateDcmStats = functions
    .runWith(runtimeConfig)
    .https
    .onRequest( async (request, response) => {
      try {
        const browser = await puppeteer.launch( {
            args: chromeArgs,
            headless: true,
        } );
        const page = await browser.newPage();

        // Top page.
        await page.goto(DCM_TOP_URL);

        // Search login URL.
        const links: ElementHandle[] = await page.$$("a");
        let loginLink: ElementHandle|null = null;
        for (const link of links) {
          const prop = await link.getProperty("href");
          const json = await prop.jsonValue();
          const url = decodeURIComponent(json.toString());

          if (url.startsWith(DCM_LOGIN_URL) && url.includes(DCM_TOP_URL)) {
            if (loginLink !== null) {
              response.send("ERROR: Over 2 Login Links Detected.");
              return;
            }
            loginLink = link;
          }
        }
        if (loginLink === null) {
          response.send("ERROR: No Login Link Detected.");
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

        response.send(`month=${monthUsed}, yesterday=${yesterdayUsed}`);
        return;
      } catch(e) {
        response.send(`ERROR: ${e.toString()}`);
        return;
      }
    } );

//////////////////////////////////////////////////////////////////////////////////////////////////

