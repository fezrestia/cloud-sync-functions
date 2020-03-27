const functions = require("firebase-functions");
import { Request, EventContext } from "firebase-functions";
import * as express from "express";
import { doUpdateDcmStats } from "./dcm_stats";

const TARGET_REGION = "asia-northeast1";
const TARGET_TZ = "Asia/Tokyo";

const runtimeConfig: { timeoutSeconds: number, memory: "128MB"|"256MB"|"512MB"|"1GB"|"2GB" } = {
  timeoutSeconds: 300,
  memory: "512MB"
};

/**
 * Debug API.
 */
export const checkStatus = functions
    .runWith(runtimeConfig)
    .https
    .onRequest( (request, response) => {
  response.send("OK");
});

//// DCM SIM STATS ////////////////////////////////////////////////////////////////////////////////
//
//

const DCM_CRON = "5 */3 * * *"; // min hour day month weekday

/**
 * Trigger to update DCM stats from HTTP request.
 */
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

/**
 * Trigger to update DCM stats from cron.
 */
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

///////////////////////////////////////////////////////////////////////////////////////////////////

