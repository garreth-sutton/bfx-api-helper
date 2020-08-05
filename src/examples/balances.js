const ApiHelper = require("../ApiHelper")

new ApiHelper()
    .setContext("v2/auth/r/wallets")
    .sendPostRequest()
    .printResponse()
    .actOnResponse(response => console.log(`Your exchange wallet TESTBTC balance is: ${response.find(walletData => walletData[0] == "exchange" && walletData[1] == "TESTBTC")[2]}`))
    .catch(r => console.log(r))