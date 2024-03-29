const CryptoJS = require("crypto-js"); // Cryptography methods for signing transactions with the users credentials
const performance = require("node:perf_hooks").performance; // lib for conveniently getting timestamps to measure performance
const request = require("request"); // Perform network requests
const fs = require("fs"); // Read from the file system (User credentials & options)
const proxymise = require("proxymise"); // Provides the fluent promises interface
const WebSocket = require("ws"); // Create WebSocket connections

const defaultRestUrl = "https://api.bitfinex.com/";
const defaultWsUrl = "wss://api.bitfinex.com/ws/2";

/**
 * ApiHelper is a lightweight wrapper for the Bitfinex API
 * It simplifies the process of communicating with the API
 * by offering a simple interface, taking care of header generation,
 * and being version agnostic.
 *
 * Simply supply the correct URL, and an optional body and / or credentials
 * and the wrapper will generate the correct headers
 * and allow you to print / catch the request response
 */
class ApiHelper {
  /**
   * Creates a reusable Bitfinex API communicator instance
   * @constructor
   * @param {string} credentialsPath - The path to the default credentials json, if no path is supplied then the root is used
   * @param {string} defaultOptionsPath - The path to the default options json, if no path is supplied then the root is used
   * @param {boolean} suppressWarnings - Flag to suppress warnings if credentials / defaults json files cannot be found
   */
  constructor(
    credentialsPath = "credentials.json",
    suppressWarnings = false,
    defaultOptionsPath = "defaults.json"
  ) {
    try {
      // Load default credentials from file
      let credentialsFile = fs.readFileSync(credentialsPath);
      let credentials = JSON.parse(credentialsFile);
      this.setCredentials(credentials.key, credentials.secret);
    } catch (e) {
      if (!suppressWarnings)
        console.log(
          `\nWarning - ApiHelper: Failed to load credentials from file @ path: ${credentialsPath}.\nOnly public endpoints can be used.\n${e.message}\n`
        );
    }

    // Per-request options object - hard-coded defaults
    this.options = {
      key: null, // Override the default key
      secret: null, // Override the default secret
      baseRestUrl: defaultRestUrl, // Override the base URL (REST API)
      baseWsUrl: defaultWsUrl, // Override the base URL (WebSocket)
      verboseOutput: false, // Print Raw request and response (Useful for debugging)
      dms: false, // Dead-mam switch, aka cancel all active orders when connection is lost (WebSocket only)
      token: null, // Optional auth token (can be used instead of api key & secret)
      filter: null, // Optional, an array of ws message stream filters, see: https://docs.bitfinex.com/docs/ws-auth#channel-filters (WebSocket only)
      performance: false, // appends a timestamp to the response (REST only), for measuring performance
      version: 0, // Optional, force API version, normally this is inferred from the API path
      optionalHeaders: {}, // Optional request headers
    };

    try {
      // Load default per-request options from file, overwrite hard-coded values
      let optionsFile = fs.readFileSync(defaultOptionsPath);
      let options = JSON.parse(optionsFile);
      this.options = { ...this.options, ...options };
    } catch (e) {
      // Ignore errors loading options file - we'll fall back to hardcoded defaults
    }
  }

  /**
   * Sets the context for an API request, starts a request Promise chain.
   * @param {string} path - The REST API path, starting with v1 or v2
   * @param {string} body - The optional request body object
   * @param {string} options - Optional per-request options object, options specified here with override any defaults loaded from defaults.json
   */
  setContext(path, body = {}, options = this.options) {
    return new Promise((resolve, reject) => {
      if (!path)
        return reject(
          "Path is not set, unable to use the API without specifying an API path."
        );
      if (!body) body = {};
      this.options = { ...this.options, ...options };
      this.setVerbose(this.options.verboseOutput);
      this.setBaseUrl(this.options.baseRestUrl);
      this.setPath(path);
      this.setBody(body);
      this.setCredentials(
        this.options.key,
        this.options.secret,
        this.options.token
      );

      return resolve(this);
    });
  }

  /**
   * Creates an initialized and authenticated WebSocket instance
   * @param {object} options - Optional per-request options object, options specified here with override any defaults loaded from defaults.json
   * @param {number} delayResponse - Time in ms to wait before returning an initialized socket (authenticated ops require ~250ms init time)
   * @param {number} nonce - Override the auto-generated nonce used for this request
   */
  openSocket(options = this.options, delayResponse = 0, nonce = null) {
    this.options = { ...this.options, ...options };
    this.setCredentials(options.key, options.secret);
    this.setNonce(nonce);
    return new Promise((resolve, reject) => {
      if (!this.key || !this.secret)
        return reject(
          "Unable to create WebSocket connection; credentials were not supplied."
        );

      let socket = new WebSocket(this.options.baseWsUrl);

      const authenticationPayload = this.getWebSocketSignature();

      socket.onopen = () => {
        if (this.options.verboseOutput)
          console.log(JSON.stringify(authenticationPayload, null, 2));
        socket.send(JSON.stringify(authenticationPayload));
      };

      socket.onmessage = (msg) => {
        let response = JSON.parse(msg.data);
        if (response.event == "auth") {
          if (this.options.verboseOutput)
            console.log(JSON.stringify(response, null, 2));
          socket.onmessage = undefined;
          if (response.status == "OK") {
            setTimeout(() => {
              this.ws = socket;
              return resolve(socket);
            }, delayResponse);
          } else if (
            response.status == "FAILED" &&
            response.msg == "rate: limit"
          ) {
            console.log(
              "Socket connection refused: Rate limit reached - retrying in 5 seconds"
            );
            setTimeout(() => openSocket(callback, shouldDelayCallback), 5000);
          } else {
            return reject(
              `Socket authentication failed: ${JSON.stringify(
                response,
                null,
                2
              )}`
            );
          }
        }
      };
    });
  }

  /**
   * Executes the context as a HTTP POST request
   * @param {boolean} authenticatedRequest - Determines if the HTTP header should include a signature to authenticate the request
   * @param {number} nonce - Override the auto-generated nonce used for this request
   */
  sendPostRequest(authenticatedRequest = true, nonce = null) {
    return new Promise((resolve, reject) => {
      this.setNonce(nonce);
      this.sendRequest(true, authenticatedRequest, () =>
        this.error ? reject(this) : resolve(this)
      );
    });
  }

  /**
   * Executes the context as a HTTP GET request
   * @param {boolean} authenticatedRequest - Determines if the HTTP header should include a signature to authenticate the request
   * @param {number} nonce - Override the auto-generated nonce for this request
   */
  sendGetRequest(authenticatedRequest = false, nonce = null) {
    return new Promise((resolve, reject) => {
      this.setNonce(nonce);
      this.sendRequest(false, authenticatedRequest, () =>
        this.error ? reject(this) : resolve(this)
      );
    });
  }

  /**
   * Callback used to capture and process the request response, typically at the end of the Promise chain
   * @param {function} actionFunction - A function that accepts the request response as the first argument, function will be triggered when a response is received
   */
  actOnResponse(actionFunction) {
    return new Promise((resolve, reject) => {
      actionFunction(this.response, {
        requestBody: this.body,
        requestPath: this.getFullPath(),
      });
      return resolve(this);
    });
  }

  /**
   * Prints the response as multi-line JSON, useful for debugging
   */
  printResponse() {
    return new Promise((resolve, reject) => {
      console.log(JSON.stringify(this.response, null, 2));
      return resolve(this);
    });
  }

  /**
   * Causes execution to wait for the specified time in ms, used to pace requests
   * @param {number} durationInMs - The length of time to throttle / pause / wait
   */
  throttle(durationInMs) {
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(this), durationInMs);
    });
  }

  // Private Setters
  setCredentials(key = null, secret = null, token = null) {
    if (token) {
      this.token = token;
    } else if (key && secret) {
      this.key = key;
      this.secret = secret;
    }
  }

  setBaseUrl(baseUrl) {
    this.baseUrl = baseUrl;
  }

  setVerbose(isVerbose) {
    this.isVerbose = isVerbose;
  }

  setBody(body) {
    this.body = body;
  }

  setNonce(nonce) {
    this.nonce = nonce ? nonce : (Date.now() * 1000).toString();
  }

  setPath(path) {
    if (path.startsWith("/")) {
      path = path.substring(1);
    }
    if (![1, 2].includes(this.options.version)) {
      if (path.startsWith("v1/")) {
        this.version = 1;
      } else if (path.startsWith("v2/")) {
        this.version = 2;
      } else {
        throw "Unable to determine endpoint version. Paths are expected to start with v1, v2, v3.. Aborting.";
      }
    }

    this.path = path;

    if (path.includes("?")) {
      this.path = path.split("?")[0];
      this.pathArgs = path.split("?")[1];
    } else {
      this.pathArgs = null;
    }
  }

  // Private Getters
  getFullPath() {
    return this.path + this.pathArgs ? this.pathArgs : "";
  }

  getRootUrl() {
    return this.baseUrl ? this.baseUrl : defaultRestUrl;
  }

  // Private V1 request composition functions
  getHeaderV1() {
    const headers = {};

    if (this.token) {
      headers["bfx-token"] = this.token;
    } else {
      let payload = Buffer.from(JSON.stringify(this.body)).toString("base64");
      headers["X-BFX-APIKEY"] = this.key;
      headers["X-BFX-PAYLOAD"] = payload;
      headers["X-BFX-SIGNATURE"] = this.getSignatureV1(payload);
    }
    return this.mergeOptionalHeaders(headers);
  }

  getSignatureV1(payload) {
    return CryptoJS.HmacSHA384(payload, this.secret).toString(CryptoJS.enc.Hex);
  }

  getRequestPayloadV1(authenticatedRequest) {
    this.body.request = this.path.startsWith("/") ? this.path : `/${this.path}`;
    let url = `${this.getRootUrl()}${this.body.request}`;
    if (this.pathArgs) {
      this.body.request += `?${this.pathArgs}`;
      url += `?${this.pathArgs}`;
    }
    if (!authenticatedRequest) {
      return {
        url: url,
        body: JSON.stringify(this.body),
        headers: this.mergeOptionalHeaders({}),
      };
    } else {
      this.body.nonce = this.nonce;
      const payload = {
        url: url,
        headers: this.getHeaderV1(),
        body: JSON.stringify(this.body),
      };

      // if using token, switch to json payload
      if (this.token) {
        payload.body = this.body;
        payload.json = true;
      }
      return payload;
    }
  }

  // Private V2 request composition functions
  getHeaderV2() {
    const headers = {};
    if (this.token) {
      headers["bfx-token"] = this.token;
    } else {
      headers["bfx-nonce"] = this.nonce;
      headers["bfx-apikey"] = this.key;
      headers["bfx-signature"] = this.getSignatureV2();
    }

    return this.mergeOptionalHeaders(headers);
  }

  mergeOptionalHeaders(headers) {
    return { ...this.options?.optionalHeaders, ...headers };
  }

  getSignatureV2() {
    let signature = `/api/${this.path}${this.nonce}${JSON.stringify(
      this.body
    )}`;
    return CryptoJS.HmacSHA384(signature, this.secret).toString();
  }

  getRequestPayloadV2(authenticatedRequest) {
    const path = this.path.startsWith("/") ? this.path : `/${this.path}`;
    let url = `${this.getRootUrl()}${path}`;
    if (this.pathArgs) url += `?${this.pathArgs}`;
    if (!authenticatedRequest) {
      return {
        url: url,
        body: this.body,
        headers: this.mergeOptionalHeaders({}),
        json: true,
      };
    } else {
      return {
        url: url,
        headers: this.getHeaderV2(),
        body: this.body,
        json: true,
      };
    }
  }

  // Private WS init payload composition functions
  getWebSocketSignature() {
    const payload = { event: "auth" };
    if (this.options.token) {
      payload.token = this.options.token;
    } else {
      const authPayload = "AUTH" + this.nonce;
      const authSig = CryptoJS.HmacSHA384(
        "AUTH" + this.nonce,
        this.secret
      ).toString(CryptoJS.enc.Hex);
      payload.apiKey = this.key;
      payload.authSig = authSig;
      payload.authNonce = this.nonce;
      payload.authPayload = authPayload;
    }

    if (this.options.dms) payload.dms = 4; // 4 = DMS enabled
    if (this.options.filter && Array.isArray(this.options.filter))
      payload.filter = this.options.filter;
    return payload;
  }

  // Private REST transmission function
  sendRequest(isPost, authenticatedRequest, callback) {
    if (authenticatedRequest) {
      if (!this.token) {
        if (!this.key || !this.secret) {
          console.log(
            "Warning - You are attempting an authenticated request without providing credentials.\n" +
              "Request will be performed unauthenticated.\n" +
              "If this is intentional then set the 'authenticate' flag to false to suppress warnings.\n" +
              "Or, you can provide credentials when setting the context or set up a default credentials file.\n" +
              "View the readme for more information.\n"
          );
          authenticatedRequest = false;
        }
      }
    }

    let executeRequest = isPost ? request.post : request.get;
    let requestPayload =
      this.version === 1
        ? this.getRequestPayloadV1(authenticatedRequest)
        : this.getRequestPayloadV2(authenticatedRequest);

    if (this.isVerbose)
      console.log(
        `Verbose - Request Payload: ${JSON.stringify(requestPayload)}`
      );

    this.error = null;
    this.response = null;

    this.startTime = performance.now();
    executeRequest(requestPayload, (error, response, body) => {
      this.endTime = performance.now();
      this.error = error;
      this.response =
        this.version === 1 && !this.token ? JSON.parse(body) : body;

      if (this.isVerbose)
        console.log(
          `Verbose - Response Body: ${JSON.stringify(this.response)}`
        );
      callback();
    });
  }
}

// Expose the interface only
module.exports = proxymise(ApiHelper);
