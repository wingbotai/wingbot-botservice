'use strict';

const sinon = require('sinon');
const { assert } = require('chai');
const {
    Tester, Router, Request, Processor, MemoryStateStorage
} = require('wingbot');
const BotService = require('../src/BotService');
const BotServiceSender = require('../src/BotServiceSender');
const jsonwebtoken = require('jsonwebtoken');

const INPUT_MESSAGE = {
    botId: 1,
    channelId: 'random',
    sender: { id: 'random-string' },
    message: { text: 'Hello world' },
    type: 'message',
    id: 'BxxupSfdLSxFBLNpnEo1Pz|0000000',
    from: {
        id: 'random-string',
        name: 'You',
        botId: 'random-bot-id',
        stage: 'staging',
        role: 'user'
    },
    conversation: { id: 'BxxupSfdLSxFBLNpnEo1Pz', isGroup: false },
    recipient: { id: 'cs-testbot@Hkh8NttIV6E', name: 'cs-testbot' },
    replyToId: undefined,
    locale: 'en-GB',
    serviceUrl: '/direct-line-api-url/',
    absToken: '6avLaA'
};

function createSendMock () {
    return sinon.spy(async function sendFnMock (req) {
        if (req.uri.match(/login/)) {
            return '{"access_token":"xyz-access-token"}';
        }

        return req.body;
    });
}

const SENDER_ID = 'senderid';
const PAGE_ID = 'pageid';

describe('<BotService>', function () {

    it('should treat member added message as conversation update', async () => {
        const bot = new Router();

        bot.use('start', (r, res) => {
            res.text('Hello World!');
        });

        const t = new Tester(bot);

        const sendFnMock = createSendMock();

        const botService = new BotService(t.processor, {
            appId: 'mock-id',
            appSecret: 'mock-secret',
            requestLib: sendFnMock
        });

        const textMessage = Object.assign({}, INPUT_MESSAGE, {
            type: 'conversationUpdate',
            membersAdded: [
                { id: INPUT_MESSAGE.recipient.id }
            ]
        });

        await botService.processEvent(textMessage);

        assert.deepEqual(sendFnMock.secondCall.args[0], {
            body: {
                conversation: INPUT_MESSAGE.conversation,
                from: INPUT_MESSAGE.recipient,
                // locale: INPUT_MESSAGE.locale,
                recipient: INPUT_MESSAGE.from,
                replyToId: INPUT_MESSAGE.id,
                type: 'message',
                text: 'Hello World!'
            },
            headers: {
                Authorization: 'Bearer xyz-access-token',
                'Content-Type': 'application/json'
            },
            json: true,
            method: 'POST',
            uri: '/direct-line-api-url/v3/conversations/BxxupSfdLSxFBLNpnEo1Pz/activities/BxxupSfdLSxFBLNpnEo1Pz|0000000'
        });
    });

    it('should create connector which responds with a image text', async () => {
        const bot = new Router();

        bot.use((r, res) => {
            res.image('url/image.png');
        });

        const t = new Tester(bot);

        const sendFnMock = createSendMock();

        const botService = new BotService(t.processor, {
            appId: 'mock-id',
            appSecret: 'mock-secret',
            requestLib: sendFnMock
        });

        const textMessage = Object.assign({}, INPUT_MESSAGE, {
            text: 'hello'
        });

        await botService.processEvent(textMessage);

        assert.deepEqual(sendFnMock.secondCall.args[0].body, {
            conversation: INPUT_MESSAGE.conversation,
            from: INPUT_MESSAGE.recipient,
            // locale: INPUT_MESSAGE.locale,
            recipient: INPUT_MESSAGE.from,
            replyToId: INPUT_MESSAGE.id,
            type: 'message',
            attachments: [
                { contentType: 'image/png', contentUrl: 'url/image.png' }
            ]
        });
    });

    it('should parse attachments', async () => {
        const bot = new Router();

        bot.use((r, res) => {
            if (r.hasLocation()) {
                res.text(r.attachments.length);
            }
        });

        const t = new Tester(bot);

        const sendFnMock = createSendMock();

        const botService = new BotService(t.processor, {
            appId: 'mock-id',
            appSecret: 'mock-secret',
            requestLib: sendFnMock
        });

        const textMessage = Object.assign({}, INPUT_MESSAGE, {
            text: 'hello',
            attachments: [
                { contentType: 'image/png', contentUrl: 'http' },
                { contentType: 'any/file', contentUrl: 'foo' },
                { contentType: 'no/url' }
            ],
            entities: [
                { type: 'Place', geo: { latitude: 1, longitude: 2 } }
            ]
        });

        await botService.processEvent(textMessage);

        assert.deepEqual(sendFnMock.secondCall.args[0].body, {
            conversation: INPUT_MESSAGE.conversation,
            from: INPUT_MESSAGE.recipient,
            // locale: INPUT_MESSAGE.locale,
            recipient: INPUT_MESSAGE.from,
            replyToId: INPUT_MESSAGE.id,
            type: 'message',
            text: '3'
        });
    });

    it('ignores authentication, when channel id is emulator', async () => {
        const bot = new Router();

        bot.use((r, res) => {
            res.button('Hello')
                .postBackButton('Text', 'action')
                .urlButton('Url', 'https://goo.gl')
                .send();
        });

        const t = new Tester(bot);

        const sendFnMock = createSendMock();

        const botService = new BotService(t.processor, {
            appId: 'mock-id',
            appSecret: 'mock-secret',
            requestLib: sendFnMock
        });

        const textMessage = Object.assign({}, INPUT_MESSAGE, {
            text: 'hello',
            channelId: 'emulator'
        });

        await botService.processEvent(textMessage);

        // it should be a fitst call
        assert.deepEqual(sendFnMock.firstCall.args[0].body.attachments, [
            {
                contentType: 'application/vnd.microsoft.card.hero',
                content: {
                    text: 'Hello',
                    buttons: [{
                        title: 'Text',
                        type: 'postBack',
                        value: {
                            payload: '{"action":"/action","data":{}}'
                        }
                    }, {
                        title: 'Url',
                        type: 'openUrl',
                        value: 'https://goo.gl'
                    }]
                }
            }
        ]);
    });

    it('transforms postbacks and carousels', async () => {
        const bot = new Router();

        bot.use('go', (r, res) => {
            /* eslint-disable indent */
            res.genericTemplate()
                .addElement('title', 'subtitle')
                    .setElementImage('/local.png')
                    .setElementAction('https://www.seznam.cz')
                    .postBackButton('Button title', 'action', { actionData: 1 })
                .addElement('another', 'subtitle')
                    .setElementImage('https://goo.gl/image.png')
                    .setElementActionPostback('action', { actionData: 1 })
                    .urlButton('Local link with extension', '/local/path', true, 'compact')
                .addElement('cheap')
                    .urlButton('Local link with extension', 'https://www.cz', true, 'compact')
                .send();
            /* eslint-enable indent */
        });

        const t = new Tester(bot);

        const sendFnMock = createSendMock();

        const botService = new BotService(t.processor, {
            appId: 'mock-id',
            appSecret: 'mock-secret',
            requestLib: sendFnMock
        });

        const textMessage = Object.assign({}, INPUT_MESSAGE, {
            value: { payload: 'go' }
        });

        await botService.processEvent(textMessage);

        assert.deepEqual(sendFnMock.secondCall.args[0].body.attachments, [
            {
                contentType: 'application/vnd.microsoft.card.hero',
                content: {
                    title: 'title',
                    subtitle: 'subtitle',
                    images: [{
                        url: '/local.png',
                        tap: {
                            type: 'openUrl',
                            value: 'https://www.seznam.cz'
                        }
                    }],
                    buttons: [{
                        title: 'Button title',
                        type: 'postBack',
                        value: {
                            payload: '{"action":"/action","data":{"actionData":1}}'
                        }
                    }]
                }
            },
            {
                contentType: 'application/vnd.microsoft.card.hero',
                content: {
                    title: 'another',
                    subtitle: 'subtitle',
                    images: [{
                        url: 'https://goo.gl/image.png',
                        tap: {
                            type: 'postBack',
                            value: {
                                payload: '{"action":"/action","data":{"actionData":1}}'
                            }
                        }
                    }],
                    buttons: [{
                        title: 'Local link with extension',
                        type: 'openUrl',
                        value: '/local/path#token=&senderId=random-string'
                    }]
                }
            },
            {
                contentType: 'application/vnd.microsoft.card.hero',
                content: {
                    title: 'cheap',
                    buttons: [{
                        title: 'Local link with extension',
                        type: 'openUrl',
                        value: 'https://www.cz#token=&senderId=random-string'
                    }]
                }
            }
        ]);
    });

    it('passes FB messages in raw format', async () => {
        const bot = new Router();

        bot.use((r, res) => {
            res.text('Hello World!');
        });

        const t = new Tester(bot);

        const sendFnMock = createSendMock();

        const botService = new BotService(t.processor, {
            appId: 'mock-id',
            appSecret: 'mock-secret',
            requestLib: sendFnMock
        });

        const textMessage = Object.assign({}, INPUT_MESSAGE, {
            channelId: 'facebook',
            attachments: [
                { contentType: 'image/png', contentUrl: 'http' }
            ]
        });

        await botService.processEvent(textMessage);

        assert.deepEqual(
            sendFnMock.secondCall.args[0].body.channelData,
            {
                message: {
                    text: 'Hello World!'
                },
                messaging_type: 'RESPONSE',
                recipient: {
                    id: 'random-string'
                }
            }
        );
    });

    const PRIVATE = `-----BEGIN RSA PRIVATE KEY-----
MIIBOgIBAAJAeH4PccUIkg5y8/Opm3zcj+b4WR+e8mMjh4IS8ulAHI76Zhv3zxBX
fBXyiqCzJego4NUNzHDrnpfs5KKM8/ExJwIDAQABAkA2w70LTa2ejNisjnPpSvAI
q8b24wtgSbUNUw5/v4o3MBHkj6cQcn00wptuHd6WFKefFlrBe1AxIZcFjVBrzZ+5
AiEA7pj3xLn7N3dJ0Wv2lv0pSUvxItY/OeAXw8Etsw+ePFsCIQCBR900bkmCuQXH
VkI/8kxdYR49jgne8lXFo/TSQCDoJQIgdsxVOW98pM5RQ+OkoOMmRmd4heb1DiUE
0CQEVA6ns9cCIQCAxJC7EYLc1ue/ldZlFTUk6YASdbC1RRFTy6wl40QjlQIhANMy
lV2Xx/N93MF2NtuAmSsyf4VEu9aHfAj3WzMbKy8n
-----END RSA PRIVATE KEY-----`;

    const PUBLIC = `-----BEGIN PUBLIC KEY-----
MFswDQYJKoZIhvcNAQEBBQADSgAwRwJAeH4PccUIkg5y8/Opm3zcj+b4WR+e8mMj
h4IS8ulAHI76Zhv3zxBXfBXyiqCzJego4NUNzHDrnpfs5KKM8/ExJwIDAQAB
-----END PUBLIC KEY-----`;

    describe('#verifyRequest()', function () {

        this.timeout(8000);

        let bsKey;
        let emulKey;
        let bs;

        before(async () => {
            bs = new BotService({}, { appId: 'fo', appSecret: 'x', overPublic: PUBLIC });

            // lets get emulator key
            const [key] = await bs._getRequestValidator(BotService.EMULATOR)._getPublicKeys();
            emulKey = key.kid;

            // lets get botservice key
            const keys = await bs._getRequestValidator(BotService.BOTSERVICE)._getPublicKeys();
            bsKey = keys.find(k => (k.endorsements || []).includes('facebook')).kid;

        });

        it('proceeds, on token signature', async () => {
            const jwtToken = jsonwebtoken
                .sign({ aud: 'fo' }, PRIVATE, { keyid: emulKey, algorithm: 'RS256' });

            await bs.verifyRequest({
                channelId: 'emulator'
            }, {
                Authorization: `Bearer ${jwtToken}`
            });

            await bs.verifyRequest({
                channelId: 'emulator'
            }, {
                Authorization: `Bearer ${jwtToken}`
            });

            const jwtFbToken = jsonwebtoken
                .sign({ aud: 'fo' }, PRIVATE, { keyid: bsKey, algorithm: 'RS256' });

            await bs.verifyRequest({
                channelId: 'facebook'
            }, {
                Authorization: `Bearer ${jwtFbToken}`
            });
        });

        it('fails with missing or bad header', async () => {
            let err;
            try {
                await bs.verifyRequest({ channelId: 'emulator' }, { Authorization: 'xyz' });
            } catch (e) {
                err = e.message;
            }
            assert.strictEqual(err, 'Unauthorized: Missing or bad Token');

            err = null;
            try {
                await bs.verifyRequest({ channelId: 'emulator' }, {});
            } catch (e) {
                err = e.message;
            }
            assert.strictEqual(err, 'Unauthorized: Missing or bad Token');
        });

        it('fails with bad jwt token', async () => {
            let err;
            try {
                await bs.verifyRequest({ channelId: 'emulator' }, { Authorization: 'Bearer xyz' });
            } catch (e) {
                err = e.message;
            }
            assert.strictEqual(err, 'Unauthorized: Invalid token');
        });

        it('fails with jwt token without key', async () => {
            const jwtFbToken = jsonwebtoken
                .sign({ aud: 'fo' }, PRIVATE, { algorithm: 'RS256' });

            let err;
            try {
                await bs.verifyRequest({ channelId: 'emulator' }, { Authorization: `Bearer ${jwtFbToken}` });
            } catch (e) {
                err = e.message;
            }
            assert.strictEqual(err, 'Unauthorized: Unable to find right key');
        });
    });

    describe('#sendMessage()', () => {

        it('is able to send message in any time, when there is a message in state', async () => {

            const bot = new Router();

            bot.use('start', (req, res) => {
                res.text('Hello');
            });

            const sendFnMock = createSendMock();

            const stateStorage = new MemoryStateStorage();

            const p = new Processor(bot, {
                stateStorage
            });

            const botService = new BotService(p, {
                appId: 'mock-id',
                appSecret: 'mock-secret',
                requestLib: sendFnMock
            });

            let message = Request.postBack(SENDER_ID, 'start');

            const messageSender = new BotServiceSender(
                {},
                SENDER_ID,
                Object.assign({}, INPUT_MESSAGE, { channelId: 'emulator' }),
                console,
                sendFnMock
            );

            // @ts-ignore
            await p.processMessage(message, PAGE_ID, messageSender);

            message = Request.postBack(SENDER_ID, 'start');

            const r = await botService.processMessage(message, SENDER_ID, PAGE_ID);

            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.responses.length, 1);
            assert.strictEqual(r.responses[0].text, 'Hello');

            assert.strictEqual(sendFnMock.callCount, 2);
            assert.strictEqual(sendFnMock.secondCall.args[0].body.text, 'Hello');


        });

    });

});
