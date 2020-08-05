const ApiHelper = require("bfx-api-helper")

const requestBody = { ccy1: "BTC", ccy2: "USD" }
new ApiHelper()
    .setContext("v2/calc/fx", requestBody)
    .sendPostRequest()
    .printResponse()
    .catch(r => console.log(r))