/*
 * @author David Menger
 */
'use strict';

const { Request } = require('wingbot');
const request = require('request-promise-native');
const BotserviceSender = require('./BotserviceSender');
const parseAttachments = require('./parseAttachments');

const ABS_TOKEN_EXPIRATION_WINDOW = 120000; // two minutes

class Botservice {

    /**
     *
     * @param {Processor} processor
     * @param {Object} options
     * @param {string} options.clientId - botservice client id
     * @param {string} options.clientSecret - botservice client secret
     * @param {string} [options.grantType] - boservice authentication grant_type
     * @param {string} [options.scope] - boservice authentication scope
     * @param {string} [options.uri] - boservice authentication uri
     * @param {Function} [options.requestLib] - request library replacement
     * @param {console} [senderLogger] - optional console like chat logger
     */
    constructor (processor, options, senderLogger = null) {
        this._options = {
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
            uri, grantType, clientId, clientSecret, scope
        } = this._options;

        const data = await this._request({
            uri,
            form: {
                grant_type: grantType,
                client_id: clientId,
                client_secret: clientSecret,
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

        return new BotserviceSender(opts, opts.from.id, body, this._senderLogger, this._request);
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

}

module.exports = Botservice;
