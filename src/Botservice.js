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
     * @param {Processor} processor
     * @param {Object} options
     * @param {string} options.appId - botservice client id
     * @param {string} options.appSecret - botservice client secret
     * @param {string} [options.grantType] - boservice authentication grant_type
     * @param {string} [options.scope] - boservice authentication scope
     * @param {string} [options.uri] - boservice authentication uri
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

    _getMeta (eventBody) {
        return {
            id: eventBody.id,
            from: eventBody.from,
            conversation: eventBody.conversation,
            recipient: eventBody.recipient,
            replyToId: eventBody.replyToId,
            locale: eventBody.locale,
            serviceUrl: eventBody.serviceUrl,
            channelId: eventBody.channelId
        };
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

    /**
     *
     * @param {bs.Activity} body - event body
     */
    async _createSender (body) {
        const opts = this._getMeta(body);

        if (body.channelId !== 'emulator') {
            const absToken = await this._getToken();
            Object.assign(opts, { absToken });
        }

        return new BotServiceSender(opts, opts.from.id, body, this._senderLogger, this._request);
    }

    /**
     * Process Facebook request
     *
     * @param {bs.Activity} body - event body
     * @returns {Promise<Array<{message:Object,pageId:string}>>} - unprocessed events
     */
    async processEvent (body) {
        const senderId = body.from.id;
        const pageId = body.channelId;

        let req;

        if (body.type === 'message') {

            if (body.value) {
                // quick reply
                req = Request.quickReplyText(senderId, body.text, body.value);
            } else if (body.text) {
                req = Request.text(senderId, body.text);
            }

            req = parseAttachments(body, req);

        } else if (body.type === 'conversationUpdate'
            && body.membersAdded
            && body.membersAdded[0].id === body.recipient.id) {

            req = Request.postBack(senderId, this._options.welcomeAction);
        } else {
            return [];
        }

        const messageSender = await this._createSender(body);

        return this.processor.processMessage(req, pageId, messageSender);
    }


    /**
     *
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
     * @param {Object} body - parsed body
     * @param {Object} headers
     * @throws {Error} when x-hub-signature does not match body signature
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
