const puppeteer = require("puppeteer");
import { Browser, Page } from "puppeteer";
const https = require("https");
import { IncomingMessage } from "http";

/**
 * Generate puppeteer web driver browser instance.
 *
 * @return Puppeteer browser instance.
 */
export async function genBrowser(): Promise<Browser> {
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

/**
 * Generate puppeteer Page instance from browser.
 *
 * @param browser Puppeteer Browser instance.
 * @param validUrlPattern
 * @return Puppeteer Page instance.
 */
export async function genPage(browser: Browser, validUrlPattern: string): Promise<Page> {
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

/**
 * Submit HTTP PUT request.
 *
 * @param url
 * @param json Body object.
 * @return Log message. Not "OK" message is error message.
 */
export async function asyncPutHttps(url: string, json: any): Promise<string> {
  return new Promise<string>( (resolve: (string) => void) => {
    const options = {
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
    };

    console.log("## https.request");
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

