import functions = require("firebase-functions");
import admin = require("firebase-admin");
import {
    TARGET_REGION,
    TARGET_TZ,
    RUNTIME_CONFIG,
    CallResponse,
    DEFAULT_CALL_RESPONSE,
    genResponse,
    isValidUser,
} from "../entry";

/**
 * Create new user.
 */
export const callCreateNewUser = functions
    .runWith(RUNTIME_CONFIG)
    .region(TARGET_REGION)
    .https
    .onCall( async (data: any, context: functions.https.CallableContext): Promise<CallResponse> => {
      if (!isValidUser(context.auth)) {
        return genResponse(true, "NG, invalid user.");
      }

      const mail = data.mail;
      const pass = data.pass;

      const firebase = admin.initializeApp();

      let res: CallResponse = DEFAULT_CALL_RESPONSE;

      await firebase.auth().createUser( {
          email: mail,
          password: pass,
      } ).then( (user: admin.auth.UserRecord) => {
        res = genResponse(false, "OK");
      } ).catch( (error: Error) => {
        console.log(`## ERROR: Failed to create user. err.msg=${error.message}`);
        res = genResponse(true, `Failed to create user. err.msg=${error.message}`);
      } );

      await firebase.delete()
          .then( () => {
            // OK.
            console.log("## FirebaseAdminApp.delete() : OK");
          } )
          .catch( (error: Error) => {
            // NG.
            console.log(`## FirebaseAdminApp.delete() : NG. err=${error.message}`);
            const last = res.message;
            res.message = `${last}, Failed to delete firebase.`;
          } );

      return res;
    } );

