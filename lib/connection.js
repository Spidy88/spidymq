"use strict";

const request = require('request');
const bodyParser = require('body-parser');
const Router = require('router');

/**
 * A SpidyMQ connection that allows for easy communication with a SpidyMQ server
 */
class Connection {
    /**
     * Constructor for a SpidyMQ Connection.
     * @constructor
     * @param {string} url - The SpidyMQ server to connect to in host:port format
     * @param {Object} config - Configuration for our connection
     * @param {string} config.serverUrl - The server url that this connection can be reached at for messages
     * @param {string} [config.mountPath] - An optional alternative mount path for the router. Default is '/spidymq'
     * @param {boolean} [config.useBodyParser] - Set to false if you don't want SpidyMQ attaching a json body parser to its route (you may already have it setup). Defaults to true
     */
    constructor(url, config) {
        // Verify a configuration was provided since we require a config.serverUrl
        if( !config ) {
            throw new Error('Cannot create a connection without the proper configuration');
        }

        // TODO: Make this optional. Pure producers won't need this
        // Make sure our local server url is supplied. Can't receive messages otherwise
        if( !config.serverUrl ) {
            throw new Error('Cannot create a connection without knowing our local server url');
        }

        // Remove the trailing '/'
        let serverUrl = config.serverUrl;
        if( serverUrl[serverUrl.length - 1] === '/' ) {
            serverUrl = serverUrl.slice(0, -1);
        }

        let mountPath = config.mountPath || '/spidymq';
        let messagePath = mountPath + '/:channel';
        let useBodyParser = config.useBodyParser !== false;

        this._baseUrl = url;
        this._notifyBaseUrl = serverUrl + mountPath;
        this._subscribers = {};
        this._connected = false;
        this.router = Router();

        // Attach body parser's json middleware unless told not to
        if( useBodyParser ) {
            this.router.use( mountPath, bodyParser.json() );
        }

        // This is the route all SpidyMQ messages will come in on
        this.router.post(messagePath, this._handleMessage.bind(this));
    }

    /**
     * Whether the connection is currently connected to the SpidyMQ server.
     * @returns {boolean} Returns TRUE if we are connected
     */
    isConnected() {
        return this._connected;
    }

    /**
     * Connect to the SpidyMQ server endpoint. Since there is not a persistent connection, this purely toggles
     * the state to connected.
     * @param {Function} [done] A callback function that will be called when connected (or an error occurs)
     * @throws {Error} If already connected
     */
    connect(done) {
        done = done || function() {};

        if( this._connected ) {
            throw new Error('Connection already established');
        }

        this._connected = true;
        done(null, true);
    }

    /**
     * Disconnects from the SpidyMQ server endpoint. Also unsubscribes all current subscribers.
     * @param {Function} [done] A callback function that will be called when disconnected (or an error occurs)
     * @throws {Error} If not connected
     */
    disconnect(done) {
        done = done || function() {};

        if ( !this._connected ) {
            throw new Error('Connection already disconnected');
        }

        // Unsubscribe from all channels
        let channelName;
        for( channelName in this._subscribers ) {
            this.unsubscribeChannel(channelName);
        }

        this._connected = false;
        done(null, true);
    }

    /**
     * Create a channel on the SpidyMQ server.
     * @param {string} name - The name of the channel
     * @param {Object} [options] - Options for the channel
     * @param {string} [options.type] - The type of channel to create. May be left blank for default.
     * @param {Function} [done] - Node-style callback function
     * @throws {Error} If connection is not established
     * @throws {Error} If no channel name is provided
     */
    createChannel(name, options, done) {
        options = options || {};
        done = done || function() {};

        if( !this._connected ) {
            throw new Error('Connection not established');
        }

        // TODO: Better validation and sanitization
        if( !name ) {
            throw new Error('Cannot create a channel without a name');
        }

        let req = {
            name: name,
            type: options.type
        };

        request
            .post({
                url: this._baseUrl + '/channel',
                json: true,
                body: req
            })
            .on('response', (response) => this._handleResponse(response, done))
            .on('error', (error) => {
                done(error);
            });
    }

    /**
     * Subscribe to a channel to receive messages from the queue
     * @param {string} channelName - The name of the channel
     * @param {Function} notifyFn - The callback function to execute when a message is received
     * @param {Function} [done] - A node-style callback function for when this request finishes
     * @throws {Error} - If connection is not established
     * @throws {Error} - If no channel name is provided
     * @throws {Error} - If no notify function is provided
     * @throws {Error} - If we've already subscribed to the channel
     */
    subscribeChannel(channelName, notifyFn, done) {
        done = done || function() {};

        if( !this._connected ) {
            throw new Error('Connection not established');
        }

        // TODO: Better validation and sanitization
        if( !channelName ) {
            throw new Error('Cannot subscribe to a channel without a name');
        }

        // TODO: Better validation and sanitization
        if( !notifyFn ) {
            throw new Error('Cannot subscribe to a channel with a notify callback');
        }

        // If we're already subscribed to this channel, throw an exception
        if( this._subscribers.hasOwnProperty(channelName) ) {
            throw new Error('Already subscribed to this channel');
        }

        this._subscribers[channelName] = notifyFn;

        let req = {
            name: channelName,
            notifyUrl: this._notifyBaseUrl + '/' + channelName
        };

        request
            .post({
                url: this._baseUrl + '/subscribe',
                json: true,
                body: req
            })
            .on('response', (response) => {
                // If we weren't successful, remove our internal subscriber
                if( response.statusCode !== 200 && response.statusCode !== 304 ) {
                    delete this._subscribers[channelName];
                }

                this._handleResponse(response, done);
            })
            .on('error', (error) => {
                delete this._subscribers[channelName];
                done(new Error('Unable to subscribe to channel'));
            });
    }

    /**
     * Unsubscribe from a channel to stop receiving messages from that queue
     * @param {string} channelName - The name of the channel
     * @param {Function} [done] - A node-style callback for when this request finishes
     * @throws {Error} - If a connection is not established
     * @throws {Error} - If no channel name is given
     */
    unsubscribeChannel(channelName, done) {
        done = done || function() {};

        if( !this._connected ) {
            throw new Error('Connection not established');
        }

        // TODO: Better validation and sanitization
        if( !channelName ) {
            throw new Error('Cannot unsubscibe from a channel without a name');
        }

        // We don't check our internal subscribers, since SpidyMQ may still be sending us
        // messages from the last time we subscribed if we failed to unsubscribe.

        // We may receive a message before the request makes it to the server
        // however we obviously aren't interested in it, so we will delete
        // our subscriber now. Any messages will be rejected with a 400
        delete this._subscribers[channelName];

        let req = {
            name: channelName,
            notifyUrl: this._notifyBaseUrl + '/' + channelName
        };

        request
            .post({
                url: this._baseUrl + '/unsubscribe',
                json: true,
                body: req
            })
            .on('response', (response) => this._handleResponse(response, done))
            .on('error', (error) => {
                done(new Error('Unable to unsubscribe from channel'));
            });
    }

    /**
     * Publish a message to a channel queue
     * @param {string} channelName - The name of the channel
     * @param {*} content - The content to place in the queue. Usually a request object
     * @param {Function} [done] - A node-style callback for when this request finishes
     * @throws {Error} - If a connection is not established
     * @throws {Error} - If no channel name is given
     * @throws {Error} - If no content is given
     */
    publishMessage(channelName, content, done) {
        done = done || function() {};

        if( !this._connected ) {
            throw new Error('Connection not established');
        }

        // TODO: Better validation and sanitization
        if( !channelName ) {
            throw new Error('Cannot publish a message to a channel without a name');
        }

        if( content === null || content === undefined ) {
            throw new Error('Cannot publish null or undefined content');
        }

        let req = {
            channel: channelName,
            content: content
        };

        request
            .post({
                url: this._baseUrl + '/message',
                json: true,
                body: req
            })
            .on('response', (response) => this._handleResponse(response, done))
            .on('error', (error) => {
                done(error);
            });
    }

    /**
     * A simple handler for all responses from SpidyMQ.
     * Requests that are successful return a 200 status
     * Requests that don't change the current state return a 304 status (i.e. channel already exists)
     * Requests that fail because of a user defined value return a 400 status
     * Requests that fail because of the SpidyMQ server return a 500 status
     * @param response
     * @param done
     * @private
     */
    _handleResponse(response, done) {
        let result = null;
        let error = null;

        // If the statusCode is 200, we successfully subscribed
        if( response.statusCode === 200 ) {
            result = true;
        }
        // If the statusCode is 304, we were already subscribed
        else if( response.statusCode === 304 ) {
            result = false;
        }
        // If the statusCode is 400, the channel does not exist
        else if( response.statusCode === 400 ) {
            error = new Error('Bad request');
        }
        // Otherwise there was a server error
        else {
            error = new Error('Server error');
        }

        done(error, result);
    }

    /**
     * Handles incoming messages from SpidyMQ
     * @param req
     * @param res
     * @private
     */
    _handleMessage(req, res) {
        // If we aren't connected, ignore the message
        if( !this._connected ) {
            res.end();
        }

        let channel = req.url.split('/').pop();
        let message = req.body;

        if( !this._subscribers.hasOwnProperty(channel) ) {
            res.statusCode = 400;
            res.end();
            return;
        }

        this._subscribers[channel](message);
    }
}

module.exports = Connection;