# ApiHelper

### A lightweight Node.js wrapper for the Bitfinex API

### View the [Bitfinex API documentation](https://docs.bitfinex.com/reference)

# Installation & import

Install using NPM:

`npm i bfx-api-helper`

Then import bfx-api-node inside your script:

`const ApiHelper = require("bfx-api-helper")`

# Overview

### The purpose of ApiHelper is to abstract the complexity of interfacing with the Bitfinex API, particularly with API calls that require authentication with a key & secret.

### ApiHelper will determine what version of the REST API you would like to use, and generate the correct authentication headers for that version.

### Simply provide the credentials, the correct endpoint URL, and optional body / request params, and ApiHelper will take care of the rest.

# Features

- Asynchronous & Fluent Interface:

```
// An example of using ApiHelper to update an order
new ApiHelper()
    .setContext("v2/auth/w/order/update", { id: 48513532021, amount: "10" })
    .sendPostRequest()
    .actOnResponse(response => console.log(`Order Updated!\n${response}`))
```

- Version agnostic - Works with both V1 & V2 of the Bitfinex API, just pass the correct route and body; ApiHelper will take care of the rest.
- WebSocket Support - ApiHelper can provide an authenticated WebSocket instance, taking care of Authentication Payload generation.

# Basic Usage

## REST

### Usage is very simple and generally consists of 4 steps - Instantiate, set context, send, act on response

```
new ApiHelper()                                         // Instantiate
    .setContext("v2/platform/status")                   // Set the context of the call (route, body)
    .sendGetRequest()                                   // Send the request (POST | GET)
    .actOnResponse(response => console.log(response))   // (Optional) Handle the response
```

## WebSocket

### To generate an authenticated WebSocket instance simply instantiate ApiHelper and call openSocket(), the promise will resolve with the WebSocket instance.

```
new ApiHelper()
    .openSocket()
    .then(socket => socket.onmessage = message => console.log(JSON.parse(message.data)))
```

# Providing credentials

### The easiest way to provide credentials is via a `credentials.json` file.

At the application root, create a file named `credentials.json` with the following format:

```
{
    key: "paste key here",
    secret: "paste secret here"
}
```

When ApiHelper is instantiated, it will search for this file at the application root (or, at the path passed to the constructor), and use the `key` and `secret` values contained within as the credentials for generating authentication headers.

Alternatively, an options object can be provided when calling `.setContext()`, inside you can provide / override the key and secret value per-request:

```
.setContext(`"v2/auth/w/order/update"`, { id: 48513532021, amount: "10" }, {key: "abc", secret: "123"})
```

# Advanced Usage

## Instantiation

`new ApiHelper(credentialsPath = "credentials.json", suppressWarnings = false)`

The constructor loads the credentials from the `credentials.json` file at the application root.
If the file is located elsewhere then a path can be provided to the constructor:

```
new ApiHelper("./secure/keys/key_and_secret.json") // Use a custom credentials file path & name
```

Note: if the constructor cannot locate a credentials file then a warning will be printed.

If you do not intend to use a credentials file - e.g. you intend to only make unauthenticated calls, or, you'll provide credentials on a per-request basis, then the warning can be suppressed by passing a flag as the second argument:

```
new ApiHelper(null, true) // No credentials path & suppress warnings
```

## Set Context

```
.setContext(path, body = {}, options = this.options)
```

Setting the `context` is a requirement for making a REST API request. At the minimum an API `route/path` needs to be provided as the first argument:

```
.setContext("v2/trades/tBTCUSD/hist")
```

If the request has `URL parameters`, simply append them to the given route as documented:

```
setContext("v2/trades/tBTCUSD/hist?limit=10&sort=1")
```

If the request requires a `body`, provide a JSON object body as the second argument. `null` or `{}` are also acceptable values to indicate an empty body:

```
.setContext("v2/auth/w/order/update", { id: 48513532021, amount: "10" })
```

The third parameter is an `options` object, and has the following expected format & default values:

```
this.options = {
    key: null,                  // Override the default key
    secret: null,               // Override the default secret
    baseRestUrl: defaultRestUrl,// Override the base URL (REST API)
    baseWsUrl: defaultWsUrl,    // Override the base URL (WebSocket)
    verboseOutput: false,       // Print Raw request and response (Useful for debugging)
    dms: false,                 // Dead-mam switch, aka cancel all active orders when connection is lost (WebSocket only)
    token: null,                // Optional auth token (can be used instead of api key & secret)
    filter: null,               // Optional, an array of ws message stream filters, see: https://docs.bitfinex.com/docs/ws-auth#channel-filters (WebSocket only)
    performance: false,         // appends a timestamp to the response (REST only), for measuring performance
    version: 0,                 // Optional, force API version, normally this is inferred from the API path
}
```

By providing an options argument, you can override the default settings such as logging level - The Options argument is also the place to specify a key and secret on a per-request basis.

```
// Update order example - Via options, use the provided key and secret, and enable verbose logging
.setContext(`"v2/auth/w/order/update"`, { id: 48513532021, amount: "10" }, {key: "paste key", secret: "paste secret", verboseOutput: true})
```

## Send The Request

Requests can be sent as POST or GET requests. How you send the request is dictated by the API documentation.
If the documentation specifies that the API route supports GET, then call:

```
.sendGetRequest()
```

Alternatively if the documentation specifies that the API route supports POST, then call:

```
.sendPostRequest()
```

Once the call has been made, transmission will occur.

By default, `GET` requests are sent as `unauthenticated` requests, and `POST` requests are sent as `authenticated` requests, meaning that ApiHelper will attempt to generate authentication headers.
This default behavior can be overridden by supplying an `authenticatedRequest` flag as the first argument:

```
.sendPostRequest(false) // Send an unauthenticated POST request
```

## Act on the Response

```
.actOnResponse(actionFunction)
```

Acting on a response is optional, but typically when calling the API we're interested in the response and its content.
To capture and handle the response, add `.actOnResponse()` to the call-chain and provide a delegate function that takes the response as a parameter:

```
.actOnResponse(response => console.log("Message received!: " + response))
```

## Putting it all together - Creating a chain

Remember: Instantiate => Set Context => Send => Act on Response (Optional)

```
new ApiHelper()                                                                 // Instantiate the helper
    .setContext("v2/auth/w/order/update", { id: 48513532021, amount: "10" })    // Set the context of the call to update an order
    .sendPostRequest()                                                          // Transmit as a POST request
    .actOnResponse(response => console.log(response))                           // When the response is received, print it
```
