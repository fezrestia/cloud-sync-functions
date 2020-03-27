const functions = require("firebase-functions");
import { Request, EventContext } from "firebase-functions";
import * as express from "express";
import { doUpdateDcmStats } from "./dcm_stats";
import { doUpdateNuroStats } from "./nuro_stats";

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

const DCM_CRON = "55 2,5,8,11,14,17,20,23 * * *"; // min hour day month weekday

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
        resMsg = resMsg.replace(/\r?\n/g, ", ");
        console.log(`## ${resMsg}`);
      } );

      console.log("## cronUpdateDcmStatus() : X");
    } );

///////////////////////////////////////////////////////////////////////////////////////////////////



//// NURO SIM STATS ///////////////////////////////////////////////////////////////////////////////
//
//

const NURO_CRON = "50 2,5,8,11,14,17,20,23 * * *"; // min hour day month weekday

/**
 * Trigger to update Nuro stats from HTTP request.
 */
export const httpsUpdateNuroStats = functions
    .runWith(runtimeConfig)
    .region(TARGET_REGION)
    .https
    .onRequest( async (request: Request, response: express.Response) => {
      console.log("## httpsUpdateNuroStatus() : E");

      await doUpdateNuroStats( (resMsg: string) => {
        response.send(resMsg);
      } );

      console.log("## httpsUpdateNuroStatus() : X");
    } );

/**
 * Trigger to update Nuro stats from cron.
 */
export const cronUpdateNurotats = functions
    .runWith(runtimeConfig)
    .region(TARGET_REGION)
    .pubsub
    .schedule(NURO_CRON)
    .timeZone(TARGET_TZ)
    .onRun( async (context: EventContext) => {
      console.log("## cronUpdateNuroStatus() : E");

      await doUpdateDcmStats( (resMsg: string) => {
        resMsg = resMsg.replace(/\r?\n/g, ", ");
        console.log(`## ${resMsg}`);
      } );

      console.log("## cronUpdateNuroStatus() : X");
    } );

///////////////////////////////////////////////////////////////////////////////////////////////////

