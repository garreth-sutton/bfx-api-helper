const ApiHelper = require("bfx-api-helper")

new ApiHelper()
    .setContext("v1/balances")
    .sendPostRequest()
    .printResponse()
    .actOnResponse(response => console.log(`Your exchange wallet TESTBTC balance is: ${response.find(walletData => walletData.type == "exchange" && walletData.currency == "testbtc").amount}`))
    .catch(r => console.log(r))