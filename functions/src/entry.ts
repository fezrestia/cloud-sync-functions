import functions = require("firebase-functions");
import admin = require("firebase-admin");
import { Request, EventContext } from "firebase-functions";
import * as express from "express";
import { doUpdateDcmStats } from "./sim-stats/dcm_stats";
import { doUpdateNuroStats } from "./sim-stats/nuro_stats";
import { doUpdateZeroSimStats } from "./sim-stats/zerosim_stats";
import { getLatestSimStats } from "./sim-stats/latest_sim_stats";

export const TARGET_REGION = "asia-northeast1";
export const TARGET_TZ = "Asia/Tokyo";

export const RUNTIME_CONFIG: { timeoutSeconds: number, memory: "128MB"|"256MB"|"512MB"|"1GB"|"2GB" } = {
  timeoutSeconds: 300,
  memory: "512MB"
};

/**
 * Debug API.
 */
export const checkStatus = functions
    .runWith(RUNTIME_CONFIG)
    .https
    .onRequest( (request: Request, response: express.Response) => {
      response.send("OK");
    } );

export const callCheckStatus = functions
    .runWith(RUNTIME_CONFIG)
    .region(TARGET_REGION)
    .https
    .onCall( async (data: any, context: functions.https.CallableContext): Promise<any> => {
      return "OK";
    } );

//// UTIL FUNCTION ////////////////////////////////////////////////////////////////////////////////
//
//

export interface CallResponse {
  is_error: boolean,
  message: string,
}

export const DEFAULT_CALL_RESPONSE = {
  is_error: true,
  message: "Not Initialized Yet.",
}

export function genResponse(isError: boolean, message: string): CallResponse {
  return {
    is_error: isError,
    message: message,
  };
}

export function isValidUser(auth: any): boolean {
  if (auth === undefined || auth === null) {
    return false;
  }

  const uid = auth.uid;
  if (uid === undefined || uid === null) {
    return false;
  }

  const validUid = functions.config().root.uid;
  return validUid === uid;
}

///////////////////////////////////////////////////////////////////////////////////////////////////



//// CALLABLE FUNCTION ////////////////////////////////////////////////////////////////////////////
//
//

const SRV_DCM = "dcm";
const SRV_NURO = "nuro";
const SRV_ZEROSIM = "zerosim";

/**
 * Trigger update SIM stats.
 */
export const callUpdateSimStats = functions
    .runWith(RUNTIME_CONFIG)
    .region(TARGET_REGION)
    .https
    .onCall( async (data: any, context: functions.https.CallableContext): Promise<CallResponse> => {
      if (!isValidUser(context.auth)) {
        return genResponse(true, "NG, invalid user.");
      }

      const service = data.service;
      let res: string = "";
      switch (service) {
        case SRV_DCM:
          await doUpdateDcmStats( (resJson: string) => {
            res = resJson;
          } );
          break;

        case SRV_NURO:
          await doUpdateNuroStats( (resJson: string) => {
            res = resJson;
          } );
          break;

        case SRV_ZEROSIM:
          await doUpdateZeroSimStats( (resJson: string) => {
            res = resJson;
          } );
          break;

        default:
          console.log(`## ERROR: service unknown. ${service}`);
          return genResponse(true, `NG, service=${service} is unknown.`);
      }

      return genResponse(false, res);
    } );

///////////////////////////////////////////////////////////////////////////////////////////////////



//// DCM SIM STATS ////////////////////////////////////////////////////////////////////////////////
//
//

const DCM_CRON = "55 2,5,8,11,14,17,20,23 * * *"; // min hour day month weekday

/**
 * Trigger to update DCM stats from HTTP request.
 */
export const httpsUpdateDcmStats = functions
    .runWith(RUNTIME_CONFIG)
    .region(TARGET_REGION)
    .https
    .onRequest( async (request: Request, response: express.Response) => {
      console.log("## httpsUpdateDcmStatus() : E");

      await doUpdateDcmStats( (resJson: string) => {
        response.send(`<pre>${JSON.stringify(JSON.parse(resJson), null, 4)}</pre>`);
        console.log(resJson);
      } );

      console.log("## httpsUpdateDcmStatus() : X");
    } );

/**
 * Trigger to update DCM stats from cron.
 */
export const cronUpdateDcmStats = functions
    .runWith(RUNTIME_CONFIG)
    .region(TARGET_REGION)
    .pubsub
    .schedule(DCM_CRON)
    .timeZone(TARGET_TZ)
    .onRun( async (context: EventContext) => {
      console.log("## cronUpdateDcmStatus() : E");

      await doUpdateDcmStats( (resJson: string) => {
        console.log(resJson);
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
    .runWith(RUNTIME_CONFIG)
    .region(TARGET_REGION)
    .https
    .onRequest( async (request: Request, response: express.Response) => {
      console.log("## httpsUpdateNuroStatus() : E");

      await doUpdateNuroStats( (resJson: string) => {
        response.send(`<pre>${JSON.stringify(JSON.parse(resJson), null, 4)}</pre>`);
        console.log(resJson);
      } );

      console.log("## httpsUpdateNuroStatus() : X");
    } );

/**
 * Trigger to update Nuro stats from cron.
 */
export const cronUpdateNurotats = functions
    .runWith(RUNTIME_CONFIG)
    .region(TARGET_REGION)
    .pubsub
    .schedule(NURO_CRON)
    .timeZone(TARGET_TZ)
    .onRun( async (context: EventContext) => {
      console.log("## cronUpdateNuroStatus() : E");

      await doUpdateNuroStats( (resJson: string) => {
        console.log(resJson);
      } );

      console.log("## cronUpdateNuroStatus() : X");
    } );

///////////////////////////////////////////////////////////////////////////////////////////////////



//// ZERO SIM STATS ///////////////////////////////////////////////////////////////////////////////
//
//

const ZEROSIM_CRON = "45 2,5,8,11,14,17,20,23 * * *"; // min hour day month weekday

/**
 * Trigger to update ZeroSIM stats from HTTP request.
 */
export const httpsUpdateZeroSimStats = functions
    .runWith(RUNTIME_CONFIG)
    .region(TARGET_REGION)
    .https
    .onRequest( async (request: Request, response: express.Response) => {
      console.log("## httpsUpdateZeroSimStatus() : E");

      await doUpdateZeroSimStats( (resJson: string) => {
        response.send(`<pre>${JSON.stringify(JSON.parse(resJson), null, 4)}</pre>`);
        console.log(resJson);
      } );

      console.log("## httpsUpdateZeroSimStatus() : X");
    } );

/**
 * Trigger to update ZeroSIM stats from cron.
 */
export const cronUpdateZeroSimStats = functions
    .runWith(RUNTIME_CONFIG)
    .region(TARGET_REGION)
    .pubsub
    .schedule(ZEROSIM_CRON)
    .timeZone(TARGET_TZ)
    .onRun( async (context: EventContext) => {
      console.log("## cronUpdateZeroSimStatus() : E");

      await doUpdateZeroSimStats( (resJson: string) => {
        console.log(resJson);
      } );

      console.log("## cronUpdateZeroSimStatus() : X");
    } );

///////////////////////////////////////////////////////////////////////////////////////////////////



//// GET SIM STATS ////////////////////////////////////////////////////////////////////////////////
//
//

export const httpsGetLatestSimStats = functions
    .runWith(RUNTIME_CONFIG)
    .region(TARGET_REGION)
    .https
    .onRequest( async (request: Request, response: express.Response) => {
      console.log("## httpsGetLatestSimStats() : E");

      await getLatestSimStats( (json: object) => {
        const jsonString: string = JSON.stringify(json);
        console.log(jsonString);

        response.append("Access-Control-Allow-Origin", "*");

        response.send(jsonString);
      } );

      console.log("## httpsGetLatestSimStats() : X");
    } );

///////////////////////////////////////////////////////////////////////////////////////////////////



//// AUTH /////////////////////////////////////////////////////////////////////////////////////////
//
//

import { callCreateNewUser } from "./auth/auth";

exports.callCreateNewUser = callCreateNewUser;

///////////////////////////////////////////////////////////////////////////////////////////////////

