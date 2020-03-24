import * as functions from "firebase-functions";

const puppeteer = require("puppeteer");
import { ElementHandle } from "puppeteer";

const runtimeConfig: { timeoutSeconds: number, memory: "128MB"|"256MB"|"512MB"|"1GB"|"2GB" } = {
  timeoutSeconds: 300,
  memory: "512MB"
};

export const checkStatus = functions
    .runWith(runtimeConfig)
    .https
    .onRequest( (request, response) => {
  response.send("OK");
});



//// DCM SIM STATS ///////////////////////////////////////////////////////////////////////////////
//
//

const DCM_TOP_URL = "https://www.nttdocomo.co.jp/mydocomo/data";

export const updateDcmStats = functions
    .runWith(runtimeConfig)
    .https
    .onRequest( async (request, response) => {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      // Top page.
      await page.goto(DCM_TOP_URL);

      // Search login URL.
      let links: ElementHandle[] = await page.$$("a");
      let urls: string[] = [];
      links.forEach( async (link: ElementHandle) => {
        let prop = await link.getProperty("href");
        let json = await prop.jsonValue();
        urls.push(json.toString());
      } );





      await browser.close();

      response.send(urls.join(", "));
    } );

//////////////////////////////////////////////////////////////////////////////////////////////////
