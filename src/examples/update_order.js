const ApiHelper = require("../ApiHelper")

const updateOrderRequestBody = { id: 48513532021, amount: "10" }

new ApiHelper()
    .setContext("v2/auth/w/order/update", updateOrderRequestBody)
    .sendPostRequest()
    .printResponse()
    .actOnResponse(response => console.log(`Your ${response[4][3]} order has been updated!`))
    .catch(r => console.log(r))