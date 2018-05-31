/*
 * @author David Menger
 */
'use strict';

const BotService = require('./BotService');
const BotServiceSender = require('./BotServiceSender');
const botServiceQuickReplyPatch = require('./botServiceQuickReplyPatch');

module.exports = {
    BotService,
    Botservice: BotService,
    BotServiceSender,
    botServiceQuickReplyPatch
};
