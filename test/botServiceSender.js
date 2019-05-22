/*
* @author Juraj Hríb
*/
'use strict';

const sinon = require('sinon');
const assert = require('assert');
const BotServiceSender = require('../src/BotServiceSender');

const INPUT_MESSAGE = {
    sender: { id: 'random-string' },
    message: { text: 'Hello world' },
    meta: {
        channelId: 'emulator',
        type: 'message',
        id: 'BxxupSfdLSxFBLNpnEo1Pz|0000000',
        from: {
            id: 'random-string',
            name: 'You',
            botId: 'random-bot-id',
            stage: 'staging'
        },
        conversation: { id: 'BxxupSfdLSxFBLNpnEo1Pz' },
        recipient: { id: 'cs-testbot@Hkh8NttIV6E', name: 'cs-testbot' },
        replyToId: undefined,
        locale: 'en-GB',
        serviceUrl: '/direct-line-api-url/',
        absToken: '6avLaA'
    }
};

function createLogger () {
    return {
        error: sinon.spy(),
        log: sinon.spy()
    };
}

describe('<BotServiceSender>', () => {

    it('should create sender factory and handle message', function () {
        const logger = createLogger();
        const sender = new BotServiceSender({}, 'user-id', INPUT_MESSAGE.meta, logger);

        sender.send({ wait: 50 });
        sender.send({ wait: 50 });

        const start = Date.now();

        const promise = sender.finished();

        assert(promise instanceof Promise);

        return promise
            .then(() => {
                assert(logger.log.called, 'should be called before promise is resolved');
                assert((start + 90) < Date.now());
            });

    });

    it('translates handover to event', async () => {
        const logger = createLogger();
        const req = sinon.spy(() => Promise.resolve({}));
        const sender = new BotServiceSender({}, 'user-id', INPUT_MESSAGE.meta, logger, req);

        sender.send({ recipient: { id: '1' }, target_app_id: '2' });

        const promise = sender.finished();

        assert(promise instanceof Promise);

        await promise;

        assert.deepEqual(req.firstCall.args[0], {
            uri: '/direct-line-api-url/v3/conversations/BxxupSfdLSxFBLNpnEo1Pz/activities/BxxupSfdLSxFBLNpnEo1Pz|0000000',
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: {
                type: 'event',
                name: 'passThread',
                conversation: {
                    id: 'BxxupSfdLSxFBLNpnEo1Pz'
                },
                from: {
                    id: 'cs-testbot@Hkh8NttIV6E',
                    name: 'cs-testbot'
                },
                recipient: {
                    botId: 'random-bot-id',
                    id: 'random-string',
                    name: 'You',
                    stage: 'staging'
                },
                replyToId: 'BxxupSfdLSxFBLNpnEo1Pz|0000000',
                value: {
                    targetAppId: '2',
                    metadata: {}
                }
            },
            json: true
        });
        assert(logger.log.called, 'should be called before promise is resolved');
    });

});
