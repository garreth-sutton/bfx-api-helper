const ApiHelper = require("bfx-api-helper")

new ApiHelper()
    .setContext("v2/platform/status")
    .sendGetRequest()
    .printResponse()
    .catch(r => console.log(r))