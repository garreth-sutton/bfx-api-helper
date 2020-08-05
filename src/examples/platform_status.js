const ApiHelper = require("../ApiHelper")

new ApiHelper()
    .setContext("v2/platform/status")
    .sendGetRequest()
    .printResponse()
    .catch(r => console.log(r))