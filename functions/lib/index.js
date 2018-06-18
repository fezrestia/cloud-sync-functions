"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
exports.helloWorld = functions.https.onRequest((request, response) => {
    response.send("Hello World from CloudSyncFunctions");
});
//# sourceMappingURL=index.js.map