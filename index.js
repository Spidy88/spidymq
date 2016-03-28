"use strict";

const Connection = require('./lib/connection');

/**
 * A helper function for creating a connection to a SpidyMQ server
 * @param {string} url - The url to the SpidyMQ server in the format host:port
 * @param {Object} config - The configuration for the SpidyMQ connection, passed directly through
 * @param {string} config.serverUrl - The server url that this connection can be reached at for messages
 * @returns {Connection}
 */
function createConnection(url, config) {
    return new Connection(url, config);
}

module.exports = createConnection;