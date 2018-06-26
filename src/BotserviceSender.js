/*
 * @author David Menger
 */
'use strict';

const request = require('request-promise-native');
const { ReturnSender } = require('wingbot');

class BotServiceSender extends ReturnSender {

    /**
     *
     * @param {Object} options
     * @param {string} [options.absToken]
     * @param {string} userId
     * @param {Object} incommingMessage
     * @param {string} incommingMessage.serviceUrl
     * @param {Object} incommingMessage.from
     * @param {Object} incommingMessage.recipient
     * @param {Object} incommingMessage.conversation
     * @param {string} incommingMessage.locale
     * @param {string} incommingMessage.channelId
     * @param {string} [incommingMessage.id]
     * @param {string} [incommingMessage.replyToId]
     * @param {console} [logger] - console like logger
     * @param {Function} [req] - request library replacement
     */
    constructor (options, userId, incommingMessage, logger = null, req = request) {
        super(options, userId, incommingMessage, logger);

        this._options = options;

        this.waits = true;

        this._req = req;
    }

    _makeButton (fbButton) {
        let ret;
        switch (fbButton.type) {
            case 'web_url':
                ret = {
                    type: 'openUrl',
                    value: fbButton.url
                };
                break;
            case 'postback':
                ret = {
                    type: 'postBack',
                    value: { payload: fbButton.payload }
                };
                break;
            default:
                return null;
        }
        if (fbButton.title) Object.assign(ret, { title: fbButton.title });
        return ret;
    }

    _makeButtons (buttons) {
        return buttons
            .map(btn => this._makeButton(btn))
            .filter(btn => btn !== null);
    }

    _makeHeroCard (title, subtitle, text, imageUrl, defaultAction, buttons) {
        const ret = {
            contentType: 'application/vnd.microsoft.card.hero',
            content: {}
        };

        if (title) Object.assign(ret.content, { title });
        if (subtitle) Object.assign(ret.content, { subtitle });
        if (text) Object.assign(ret.content, { text });

        if (imageUrl) {
            Object.assign(ret.content, {
                images: [{
                    url: imageUrl
                }]
            });

            if (defaultAction) {
                const tap = this._makeButton(defaultAction);

                if (tap) {
                    Object.assign(ret.content.images[0], {
                        tap
                    });
                }
            }
        }

        if (buttons) {
            Object.assign(ret.content, {
                buttons: this._makeButtons(buttons)
            });
        }

        return ret;
    }

    /**
     *
     * @param {Object} tplPayload
     * @returns {bs.SendMessage|null}
     */
    _transformTemplate (tplPayload) {
        const ret = {
            type: 'message'
        };
        switch (tplPayload.template_type) {
            case 'generic':
            case 'list': {
                if (tplPayload.elements.length > 1) {
                    Object.assign(ret, {
                        attachmentLayout: tplPayload.template_type === 'list'
                            ? 'list'
                            : 'carousel'
                    });
                }

                Object.assign(ret, {
                    attachments: tplPayload.elements
                        .map(at => this._makeHeroCard(
                            at.title,
                            at.subtitle,
                            null,
                            at.image_url,
                            at.default_action,
                            at.buttons
                        ))
                });

                return ret;
            }

            case 'button': {
                Object.assign(ret, {
                    attachments: [
                        this._makeHeroCard(
                            null,
                            null,
                            tplPayload.text,
                            null,
                            null,
                            tplPayload.buttons
                        )
                    ]
                });

                return ret;
            }

            default:
                return null;
        }
    }

    _transformMediaAttachment ({ type, payload }) {
        let attachment;

        if (type === 'file') {
            attachment = {
                contentType: 'application/octet-stream',
                contentUrl: payload.url
            };
        } else {
            let [, suffix] = `${payload.url}`.match(/\.([a-z0-9]+)$/i);
            if (!suffix) {
                suffix = type === 'image' ? 'png' : 'mpeg';
            }

            attachment = {
                contentType: `${type}/${suffix}`,
                contentUrl: payload.url
            };
        }

        return {
            type: 'message',
            attachments: [attachment]
        };
    }

    /**
     *
     * @param {Object} payload
     * @returns {bs.SendMessage|null}
     */
    _transformPayload (payload) {
        if (this._incommingMessage.channelId === 'facebook') {

            return {
                type: 'message',
                channelData: payload
            };
        }

        if (payload.sender_action === 'typing_on') {
            return {
                type: 'typing'
            };
        } else if (payload.message) {
            if (payload.message.attachment) {

                switch (payload.message.attachment.type) {
                    case 'template':
                        return this._transformTemplate(payload.message.attachment.payload);
                    case 'image':
                    case 'video':
                    case 'file':
                        return this._transformMediaAttachment(payload.message.attachment);
                    default:
                }

            }

            if (!payload.message.text) {
                return null;
            }

            const ret = {
                type: 'message',
                text: `${payload.message.text}`
            };

            if (payload.message.quick_replies) {
                const actions = payload.message.quick_replies
                    .map(qr => ({
                        type: 'imBack',
                        title: qr.title,
                        value: qr.title
                    }));

                ret.suggestedActions = {
                    to: [this._userId],
                    actions
                };
            }

            return ret;
        }
        return null;
    }

    async _send (payload) {
        try {
            const transformed = this._transformPayload(payload);

            if (!transformed) {
                return null;
            }

            const {
                absToken
            } = this._options;

            const {
                serviceUrl, conversation, id, recipient, from
            } = this._incommingMessage;

            const body = {
                from: recipient,
                conversation,
                recipient: from
            };

            let urlPath;

            if (id) {
                Object.assign(body, { replyToId: id });
                urlPath = `/v3/conversations/${conversation.id}/activities/${id}`;
            } else {
                urlPath = `/v3/conversations/${conversation.id}/activities`;
            }

            Object.assign(body, transformed);

            const headers = {
                'Content-Type': 'application/json'
            };

            if (absToken) {
                Object.assign(headers, { Authorization: `Bearer ${absToken}` });
            }

            const data = {
                uri: `${serviceUrl.replace(/\/$/, '')}${urlPath}`,
                headers,
                method: 'POST',
                body,
                json: true
            };

            const res = await this._req(data);

            return res;
        } catch (e) {
            // @todo throw "disconnected error"
            throw e;
        }
    }

    // @ts-ignore
    async modifyStateBeforeStore () {
        return {
            _lastMessage: this._incommingMessage
        };
    }

}

module.exports = BotServiceSender;
