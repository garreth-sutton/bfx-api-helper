const ApiHelper = require("bfx-api-helper")

const updateOrderPayload = [0, "ou", null, { "amount": "10", "id": 48513532021 }]

new ApiHelper()
    .openSocket(null, 250)
    .then(socket => {
        socket.send(JSON.stringify(updateOrderPayload))
        socket.onmessage = message => messageHandler(socket, JSON.parse(message.data))
    })
    .catch(r => console.log(r))

function messageHandler(socket, message) {
    if (message[1] == 'n' && message[2][4][0] == updateOrderPayload[3].id) {
        console.log(JSON.stringify(message, null, 2))
        console.log(`Your ${message[2][4][3]} order has been updated!`)
        socket.close()
    }
}