"use strict";

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const mockery = require('mockery');

const should = chai.should();
chai.use(sinonChai);

let Connection;

// Before testing gets underway, enable mockery to start intercepting `require`
before(function() {
    mockery.enable();
});

// After testing completes, disable mockery
after(function() {
    mockery.deregisterAll();
    mockery.disable();
});

describe('Connection', function() {
    let connection;
    let routerMock;
    let requestMock;
    let bodyParserMock;
    let requestCallbacks;

    beforeEach(function() {
        requestCallbacks = {};
        routerMock = function() {
            return {
                use: sinon.spy(),
                post: sinon.spy()
            };
        };
        requestMock = {
            post: function () {
                let emitter = {
                    on: function ( event, callback ) {
                        requestCallbacks[event] = callback;
                        return emitter;
                    }
                };

                return emitter;
            }
        };
        bodyParserMock = {
            json: sinon.spy()
        };

        mockery.registerAllowables([
            '../lib/connection'
        ]);

        mockery.registerMock('router', routerMock);
        mockery.registerMock('request', requestMock);
        mockery.registerMock('body-parser', bodyParserMock);

        Connection = require('../lib/connection');
    });

    afterEach(function() {
        mockery.deregisterAll();
    });

    describe('api', function() {
        beforeEach(function() {
            let url = 'http://localhost:3000/';
            let config = {
                serverUrl: 'http://localhost:3001/'
            };

            connection = new Connection(url, config);
        });

        it('should have a isConnected()', function() {
            connection.should.respondTo('isConnected');
        });

        it('should have a connect()', function() {
            connection.should.respondTo('connect');
        });

        it('should have a disconnect()', function() {
            connection.should.respondTo('disconnect');
        });

        it('should have a createChannel()', function() {
            connection.should.respondTo('createChannel');
        });

        it('should have a subscribeChannel()', function() {
            connection.should.respondTo('subscribeChannel');
        });

        it('should have an unsubscribeChannel()', function() {
            connection.should.respondTo('unsubscribeChannel');
        });

        it('should have a publishMessage()', function() {
            connection.should.respondTo('publishMessage');
        });
    });

    describe('behavior', function() {
        beforeEach(function() {
            let url = 'http://localhost:3000/';
            let config = {
                serverUrl: 'http://localhost:3001/'
            };

            connection = new Connection(url, config);
        });

        describe('#connect', function() {
            describe('when no connection is established', function() {
                it('should connect', function() {
                    connection.connect();
                    connection.isConnected().should.be.true;
                });
            });

            describe('when a connection is established', function() {
                it('should throw an exception on connect attempt', function() {
                    connection.connect();
                    should.throw(connection.connect);
                });
            });
        });

        describe('#disconnect', function() {
            describe('when no connection is established', function() {
                it('should throw an exception', function() {
                    should.throw(connection.disconnect);
                });
            });

            describe('when a connection is established', function() {
                it('should disconnect', function() {
                    connection.connect();
                    connection.disconnect();

                    connection.isConnected().should.be.false;
                });
            });

            describe('when subscribed to one or more channels', function() {
                it('should unsubscribe from channels', function() {
                    let cb1 = sinon.spy();
                    let notify1 = sinon.spy();
                    let cb2 = sinon.spy();
                    let notify2 = sinon.spy();
                    let req = {
                        url: '/spidymq/test2',
                        body: {
                            pizza: 'yum yum'
                        }
                    };
                    let res = {
                        statusCode: 0,
                        end: sinon.spy()
                    };

                    connection.connect();
                    connection.subscribeChannel('test1', notify1, cb1);
                    requestCallbacks.response({ statusCode: 200 });
                    connection.subscribeChannel('test2', notify2, cb2);
                    requestCallbacks.response({ statusCode: 200 });
                    connection.disconnect();

                    connection._handleMessage(req, res);

                    cb1.should.have.been.calledWith(null, true);
                    cb2.should.have.been.calledWith(null, true);
                    notify1.should.not.have.been.called;
                    notify2.should.not.have.been.called;
                });
            });
        });

        describe('#createChannel', function() {
            it('should require a channel name', function() {
                let cb = sinon.spy();

                connection.connect();

                should.throw(function() {
                    connection.createChannel(null, null, cb);
                });

                cb.should.not.have.been.called;
            });

            describe('when not connected', function() {
                it('should execute callback with an exception', function() {
                    let cb = sinon.spy();

                    should.throw(function() {
                        connection.createChannel('test', {}, cb);
                    });

                    cb.should.not.have.been.called;
                });
            });

            describe('when the channel does not exist yet', function() {
                it('should respond with true', function() {
                    let cb = sinon.spy();

                    connection.connect();
                    connection.createChannel('test', {}, cb);

                    requestCallbacks.response({ statusCode: 200 });

                    cb.should.have.been.calledWith(null, true);
                });
            });

            describe('when the channel already exists', function() {
                it('should respond with false', function() {
                    let cb = sinon.spy();

                    connection.connect();
                    connection.createChannel('test', {}, cb);

                    requestCallbacks.response({ statusCode: 304 });

                    cb.should.have.been.calledWith(null, false);
                });
            });

            describe('when the channel exists as a different type', function() {
                it('should respond with an error', function() {
                    let cb = sinon.spy();

                    connection.connect();
                    connection.createChannel('test', {}, cb);

                    requestCallbacks.response({ statusCode: 400 });

                    cb.args[0].should.not.be.null;
                });
            });

            describe('when the server fails', function() {
                it('should respond with true', function() {
                    let cb = sinon.spy();

                    connection.connect();
                    connection.createChannel('test', {}, cb);

                    requestCallbacks.response({ statusCode: 500 });

                    cb.args[0].should.not.be.null;
                });
            });
        });

        describe('#publishMessage', function() {
            it('should require a channel name', function() {
                let cb = sinon.spy();

                connection.connect();

                should.throw(function() {
                    connection.publishMessage(null, {}, cb);
                });

                cb.should.not.have.been.called;
            });

            describe('when not connected', function() {
                it('should throw an exception', function() {
                    let cb = sinon.spy();

                    should.throw(function() {
                        connection.publishMessage('test', {}, cb);
                    });

                    cb.should.not.have.been.called;
                });
            });

            describe('when the channel does not exist yet', function() {
                it('should respond with an exception', function() {
                    let cb = sinon.spy();

                    connection.connect();
                    connection.publishMessage('test', {}, cb);

                    requestCallbacks.response({ statusCode: 400 });

                    cb.args[0].should.not.be.null;
                });
            });

            describe('when the channel exists', function() {
                it('should respond with true', function() {
                    let cb = sinon.spy();

                    connection.connect();
                    connection.publishMessage('test', {}, cb);

                    requestCallbacks.response({ statusCode: 200 });

                    cb.should.have.been.calledWith(null, true);
                });
            });

            describe('when the server fails', function() {
                it('should respond with true', function() {
                    let cb = sinon.spy();

                    connection.connect();
                    connection.publishMessage('test', {}, cb);

                    requestCallbacks.response({ statusCode: 500 });

                    cb.args[0].should.not.be.null;
                });
            });
        });

        describe('#subscribeChannel', function() {
            let cb;
            let notify;

            beforeEach(function() {
                cb = sinon.spy();
                notify = sinon.spy();
            });

            it('should require a channel name', function() {
                connection.connect();

                should.throw(function() {
                    connection.subscribeChannel(null, notify, cb);
                });

                cb.should.not.have.been.called;
            });

            it('should require a notify function', function() {
                connection.connect();

                should.throw(function() {
                    connection.subscribeChannel('test', null, cb);
                });

                cb.should.not.have.been.called;
            });

            describe('when not connected', function() {
                it('should throw an exception', function() {
                    should.throw(function() {
                        connection.subscribeChannel('test', notify, cb);
                    });

                    cb.should.not.have.been.called;
                });
            });

            describe('when not subscribed to a channel', function() {
                it('should subscribe to a channel', function() {
                    connection.connect();
                    connection.subscribeChannel('test', notify, cb);

                    requestCallbacks.response({ statusCode: 200 });

                    cb.should.have.been.calledWith(null, true);
                });
            });

            describe('when subscribed to a channel', function() {
                beforeEach(function() {
                    connection.connect();
                    connection.subscribeChannel('test', notify, cb);

                    requestCallbacks.response({ statusCode: 200 });
                });

                it('should not subscribe to the same channel', function() {
                    let cb2 = sinon.spy();

                    should.throw(function() {
                        connection.subscribeChannel('test', notify, cb2);
                    });

                    cb2.should.not.have.been.called;
                });

                it('should subscribe to a different channel', function() {
                    connection.subscribeChannel('test2', notify, cb);

                    requestCallbacks.response({ statusCode: 200 });

                    cb.should.have.been.calledWith(null, true);
                });

                it('should receive messages from SpidyMQ for the subscribed channel', function() {
                    let req = {
                        url: '/spidymq/test',
                        body: {
                            pizza: 'yum yum'
                        }
                    };
                    let res = {
                        statusCode: 0,
                        end: sinon.spy()
                    };

                    connection._handleMessage(req, res);

                    notify.should.have.been.calledWith(req.body);
                });

                it('should not receive messages from SpidyMQ for non-subscribed channels', function() {
                    let req = {
                        url: '/spidymq/test2',
                        body: {
                            pizza: 'yum yum'
                        }
                    };
                    let res = {
                        statusCode: 0,
                        end: sinon.spy()
                    };

                    connection._handleMessage(req, res);

                    notify.should.not.have.been.called;
                });
            });
        });

        describe('#unsubscribeChannel', function() {
            let cb;

            beforeEach(function() {
                cb = sinon.spy();
            });

            it('should require a channel name', function() {
                connection.connect();

                should.throw(function() {
                    connection.unsubscribe('test', cb);
                });

                cb.should.not.have.been.called;
            });
            
            describe('when not connected', function() {
                it('should throw an exception', function() {
                    should.throw(function() {
                        connection.unsubscribeChannel('test', cb);
                    });

                    cb.should.not.have.been.called;
                });
            });
            
            describe('when subscribed to a channel', function() {
                let notify;
                let subCb;

                beforeEach(function() {
                    notify = sinon.spy();
                    subCb = sinon.spy();

                    connection.connect();
                    connection.subscribeChannel('test', notify, subCb);

                    requestCallbacks.response({ statusCode: 200 });
                });

                it('should be able to unsubscribe', function() {
                    connection.unsubscribeChannel('test', cb);
                    requestCallbacks.response({ statusCode: 200 });

                    cb.should.have.been.calledWith(null, true);
                });
                
                it('should not receive messages from SpidyMQ for unsubscribed channel', function() {
                    let req = {
                        url: '/spidymq/test',
                        body: {
                            pizza: 'yum yum'
                        }
                    };
                    let res = {
                        statusCode: 0,
                        end: sinon.spy()
                    };

                    connection.unsubscribeChannel('test', cb);
                    requestCallbacks.response({ statusCode: 200 });
                    cb.should.have.been.calledWith(null, true);

                    connection._handleMessage(req, res);
                    notify.should.not.have.been.called;
                });
                
                it('should receive messages from SpidyMQ for channels that are still subscribed', function() {
                    let notifyTest2 = sinon.spy();
                    let cb2 = sinon.spy();
                    let req = {
                        url: '/spidymq/test2',
                        body: {
                            pizza: 'yum yum'
                        }
                    };
                    let res = {
                        statusCode: 0,
                        end: sinon.spy()
                    };

                    connection.subscribeChannel('test2', notifyTest2, cb2);
                    requestCallbacks.response({ statusCode: 200 });

                    connection.unsubscribeChannel('test', cb);
                    requestCallbacks.response({ statusCode: 200 });

                    connection._handleMessage(req, res);

                    notifyTest2.should.have.been.calledWith(req.body);
                    notify.should.not.have.been.called;
                });
            });
            
            describe('when not subscribed to a channel', function() {
                it('should receive an exception', function() {
                    connection.connect();
                    connection.unsubscribeChannel('test', cb);

                    requestCallbacks.response({ statusCode: 400 });

                    cb.args[0].should.not.be.null;
                });
            });
        });
    });
});