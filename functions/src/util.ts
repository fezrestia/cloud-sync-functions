import { Page, ElementHandle } from "puppeteer";

/**
 * Get now JST date.
 *
 * @return Now JST date
 */
export function genJstDate(): Date {
  const nowUtcMillis = Date.now();
  const offsetMillis = new Date().getTimezoneOffset() * 60 * 1000; // UTC - Local
  const nowJstMillis = nowUtcMillis + offsetMillis + (9 * 60 * 60 * 1000); // +0900
  const nowJst = new Date(nowJstMillis);
  return nowJst;
}

/**
 * Generate date path from Date for SIM stats Firebase DB.
 *
 * @param date
 * @return Date path
 */
export function genDatePath(date: Date): string {
  return `y${date.getFullYear()}/m${date.getMonth() + 1}/d${date.getDate()}`;
}

/**
 * Generate today date path.
 *
 * @return Today date path.
 */
export function genTodayDatePath(): string {
  const today = genJstDate();
  const todayPath = genDatePath(today);
  return todayPath;
}

/**
 * Generate yesterday date path.
 *
 * @return Yesterday date path.
 */
export function genYesterdayDatePath(): string {
  const today = genJstDate();
  const yesterday = genJstDate();
  yesterday.setDate(today.getDate() - 1);
  const yesterdayPath = genDatePath(yesterday);
  return yesterdayPath;
}

/**
 * Parse text contents of selector.
 *
 * @param page Puppeteer Page instance.
 * @param selector
 * @return Text content
 */
export async function parseTextFromSelector(page: Page, selector: string): Promise<string> {
  const element = await page.$(selector) as ElementHandle;
  const prop = await element.getProperty("textContent");
  const json = await prop.jsonValue() as object;
  const text: string = json.toString();
  return text;
}

/**
 * Response message of JSON string.
 */
export function genResMsg(
    monthUsed: string,
    yesterdayUsed: string,
    todayUrl: string,
    yesterdayUrl: string,
    todayData: number,
    yesterdayData: number,
    todayOkNg: string,
    yesterdayOkNg: string): string {
  const resJson = {
    monthUsed: monthUsed,
    yesterdayUsed: yesterdayUsed,
    todayUrl: todayUrl,
    yesterdayUrl: yesterdayUrl,
    todayData: todayData,
    yesterdayData: yesterdayData,
    todayOkNg: todayOkNg,
    yesterdayOkNg: yesterdayOkNg,
  };
  return JSON.stringify(resJson);
}

/**
 * Error response message of JSON string.
 */
export function genErrorMsg(errorMsg: string): string {
  const errorJson = {
    error: errorMsg,
  };
  return JSON.stringify(errorJson);
}

