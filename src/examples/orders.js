const ApiHelper = require("bfx-api-helper")

new ApiHelper()
    .setContext("v2/auth/r/orders/tTESTBTC:TESTUSD")
    .sendPostRequest()
    .printResponse()
    .actOnResponse(response => console.log(`You have a ${response[0][3]} order, the amount is: ${response[0][6]} and the price is: ${response[0][16]}`))
    .catch(r => console.log(r))