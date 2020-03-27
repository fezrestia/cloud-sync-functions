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

