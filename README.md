SpidyMQ
=======

A library for interacting with SpidyMQ servers, channels, and queues.

```javascript
var SpidyMQ = require('spidymq');
var mq = SpidyMQ('<insert spidymq url:port>', { serverUrl: '<url for this server>' });

mq.connect();
mq.createChannel('pizza', { type: 'round-robin' }, function(err, result) {
    // Result holds true if newly created, false if already exists
    // Error will be null unless channel already existed as a different type, or SpidyMQ server failed
    var order = {
        ingredients: ['cheese', 'pepperoni']
        crust: 'deep dish'
    };
    mq.publishMessage('pizza', order, function(err, result) { ... });
});
```

## Installation

```
npm install --save Spidy88/spidymq
```

## Use

The v1 api is very simple.

```javascript
createChannel = function( name, config, callback ) {
    // name: String
    // config: Object
    //     type: Enum ('round-robin', 'broadcast')
    // callback: Function(Error, Boolean)
}
```

```javascript
subscribeChannel = function( channelName, notifyFn, callback ) {
    // channelName: String
    // notifyFn: Function(Any)
    // callback: Function(Error, Boolean)
}
```

```javascript
unsubscribeChannel = function( channelName, callback ) {
    // channelName: String
    // callback: Function(Error, Boolean)
}
```

```javascript
publishMessage = function( channelName, contents, callback ) {
    // name: String
    // contents: Any
    // callback: Function(Error, Boolean)
}
```

## How it works

SpidyMQ is a very simple messaging queue. This adapter sends requests over HTTP, and when subscribed, receives messages
back through HTTP. In order to receive these HTTP messages from the SpidyMQ server, the connection needs to know what
url it can be reached at (port included) and its router must be hooked up to a servers middleware. This can be done as
follows.

```javascript
var app = connect(); // Can also be express or any server that uses a standard router.use format
var SpidyMQ = require('spidymq');
var mq = SpidyMQ('<insert spidymq url:port>', { serverUrl: '<url for this server>' });

app.use(mq.router);

mq.connect();
mq.createChannel('pizza', { type: 'round-robin' }, function(err, result) {
    // Result holds true if newly created, false if already exists
    // Error will be null unless channel already existed as a different type, or SpidyMQ server failed
    var order = {
        ingredients: ['cheese', 'pepperoni']
        crust: 'deep dish'
    };
    mq.publishMessage('pizza', order, function(err, result) { ... });
});
```

The connection will mount itself at `/spidymq` and use this route for accepting messages from SpidyMQ. You may override
this mount path by providing `config.mountPath` when creating your connection.

```javascript
var app = connect();
var SpidyMQ = require('spidymq');
var mq = SpidyMQ('<insert spidymq url:port>', { serverUrl: '<url for this server>', mountPath: '/messages' });

app.use(mq.router);

mq.connect();
mq.createChannel('pizza', { type: 'round-robin' }, function(err, result) {
    // Result holds true if newly created, false if already exists
    // Error will be null unless channel already existed as a different type, or SpidyMQ server failed
    var order = {
        ingredients: ['cheese', 'pepperoni']
        crust: 'deep dish'
    };
    mq.publishMessage('pizza', order, function(err, result) { ... });
});
```

If you need even finer control of when the middleware gets executed, you can call `mq._handleMessage` yourself but it is
 not advised.
 
## Running tests and generating documentation

You can easily run tests with `npm test` or `grunt test`. The benefit of using grunt is that it will also run a `jshint`
task. The downside is it doesn't play well with CircleCI which is why there are two methods for running tests. If you'd 
like to see the generated docs, just run `grunt jsdoc`. All JSDoc documentation will be output to `/docs/jsdoc` as html.