const ApiHelper = require("../ApiHelper")

const orderStatusRequestBody = {
    order_id: 48513532021
}

new ApiHelper()
    .setContext("v1/order/status", orderStatusRequestBody)
    .sendPostRequest()
    .printResponse()
    .actOnResponse(response => console.log(`Your order type is: ${response.type}`))
    .catch(r => console.log(r))