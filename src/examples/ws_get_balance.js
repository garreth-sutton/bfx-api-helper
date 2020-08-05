const ApiHelper = require("../ApiHelper")

new ApiHelper()
    .openSocket()
    .then(socket => socket.onmessage = message => messageHandler(socket, JSON.parse(message.data)))
    .catch(r => console.log(r))

function messageHandler(socket, message) {
    if (message[1] == "ws") {
        console.log(`Your exchange TESTBTC balance is: ${message[2].find(walletData => walletData[0] == "exchange" && walletData[1] == "TESTBTC")[2]}`)
        socket.close()
    }
}