/*
 * @author David Menger
 */
'use strict';

const { Request } = require('wingbot');
const request = require('request-promise-native');
const BotServiceSender = require('./BotServiceSender');
const parseAttachments = require('./parseAttachments');
const RequestValidator = require('./RequestValidator');

// OPENID URLS
const BOTSERVICE = 'https://login.botframework.com/v1/.well-known/openidconfiguration';
const EMULATOR = 'https://login.microsoftonline.com/botframework.com/v2.0/.well-known/openid-configuration';

const ABS_TOKEN_EXPIRATION_WINDOW = 120000; // two minutes

/**
 * BotService connector for wingbot.ai
 *
 * @class
 */
class BotService {

    /**
     *
     * @param {Processor} processor - wingbot Processor instance
     * @param {Object} options
     * @param {string} options.appId - botservice client id
     * @param {string} options.appSecret - botservice client secret
     * @param {string} [options.grantType] - boservice authentication grant_type
     * @param {string} [options.scope] - boservice authentication scope
     * @param {string} [options.uri] - boservice authentication uri
     * @param {string|null} [options.welcomeAction='start'] - conversation start emits postback
     * @param {Function} [options.requestLib] - request library replacement for testing
     * @param {string} [options.overPublic] - override public key for testing
     * @param {console} [senderLogger] - optional console like chat logger
     */
    constructor (processor, options, senderLogger = null) {
        this._options = {
            appId: null,
            grantType: 'client_credentials',
            scope: 'https://api.botframework.com/.default',
            uri: 'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token',
            welcomeAction: 'start'
        };

        Object.assign(this._options, options);

        this.processor = processor;
        this._senderLogger = senderLogger;

        this._absToken = null;
        this._absTokenExpiration = null;

        this._request = options.requestLib || request;

        this._cachedValidators = new Map();
    }

    async _getToken () {
        if (this._absToken && this._absTokenExpiration >= Date.now()) {
            return this._absToken;
        }

        const {
            uri, grantType, appId, appSecret, scope
        } = this._options;

        const data = await this._request({
            uri,
            form: {
                grant_type: grantType,
                client_id: appId,
                client_secret: appSecret,
                scope
            },
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const parsedToken = JSON.parse(data);
        const expiresIn = parsedToken.expires_in * 1000;

        this._absToken = parsedToken.access_token;
        this._absTokenExpiration = (Date.now() + expiresIn) - ABS_TOKEN_EXPIRATION_WINDOW;

        return this._absToken;
    }

    async processMessage (message, senderId, pageId) {

        // fetch message data from the state
        const state = await this.processor.stateStorage.getState(senderId, pageId);

        if (!state || !state._lastMessage) {
            return {
                status: 204, // not sent
                responses: []
            };
        }

        const {
            from, recipient, serviceUrl, channelId, conversation
        } = state._lastMessage;

        // synthetize message without content
        const botsetviceEvent = {
            from,
            recipient,
            serviceUrl,
            timestamp: new Date(message.timestamp).toISOString(),
            channelId,
            conversation,
            type: 'message'
        };


        // simulate incomming event
        const messageSender = await this._createSender(botsetviceEvent);

        return this.processor.processMessage(message, pageId, messageSender);
    }

    /**
     *
     * @private
     * @param {bs.Activity} body - event body
     */
    async _createSender (body) {
        const opts = {};

        if (body.channelId !== 'emulator') {
            const absToken = await this._getToken();
            Object.assign(opts, { absToken });
        }

        return new BotServiceSender(opts, body.from.id, body, this._senderLogger, this._request);
    }

    /**
     * Process Facebook request
     *
     * @param {bs.Activity} body - event body
     * @returns {Promise<Array<{message:Object,pageId:string}>>} - unprocessed events
     */
    async processEvent (body) {
        if (!body.from) {
            return [];
        }
        const senderId = body.from.id;
        const pageId = body.channelId;

        let req;

        const timestamp = new Date(body.timestamp).getTime();

        if (body.channelId === 'facebook' && body.channelData) {
            req = body.channelData;
        } else if (body.type === 'message') {

            if (body.value && body.value.payload) {
                // quick reply
                req = Request.quickReplyText(senderId, body.text, body.value.payload, timestamp);
            } else if (body.text) {
                req = Request.text(senderId, body.text, timestamp);
            }

            req = parseAttachments(body, req);

        } else if (body.type === 'conversationUpdate'
            && this._options.welcomeAction
            && body.membersAdded
            && body.membersAdded[0].id === body.recipient.id) {

            req = Request.postBack(
                senderId,
                this._options.welcomeAction,
                {},
                null,
                {},
                timestamp
            );
        } else if (body.type === 'event'
            && body.name === 'postBack'
            && body.value
            && body.value.action) {

            const { action, data = {} } = body.value;

            req = Request.postBack(
                senderId,
                action,
                data,
                null,
                {},
                timestamp
            );
        }

        if (!req) {
            return [];
        }

        Object.assign(req, {
            _conversationId: body.conversation.id
        });

        const messageSender = await this._createSender(body);

        return this.processor.processMessage(req, pageId, messageSender);
    }


    /**
     *
     * @private
     * @param {string} openIdUrl
     * @returns {RequestValidator}
     */
    _getRequestValidator (openIdUrl) {
        if (this._cachedValidators.has(openIdUrl)) {
            return this._cachedValidators.get(openIdUrl);
        }
        const validator = new RequestValidator(openIdUrl, this._options);
        this._cachedValidators.set(openIdUrl, validator);
        return validator;
    }

    /**
     * Verify Facebook webhook event
     *
     * @param {Object} body - parsed request body
     * @param {Object} headers - request headers
     * @returns {Promise}
     * @throws {Error} when authorization token is invalid or missing
     */
    async verifyRequest (body, headers) {
        const verifier = this._getRequestValidator(body.channelId === 'emulator'
            ? EMULATOR
            : BOTSERVICE);

        await verifier.verifyRequest(body, headers);
    }

}

BotService.BOTSERVICE = BOTSERVICE;
BotService.EMULATOR = EMULATOR;

module.exports = BotService;
