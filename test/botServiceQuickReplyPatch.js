/*
 * @author David Menger
 */
'use strict';

const { Router, Tester, Request } = require('wingbot');
const botServiceQuickReplyPatch = require('../src/botServiceQuickReplyPatch');

describe('botServiceQuickReplyPatch()', () => {

    it('should set expected keywords to users with new conversation', async () => {

        const bot = new Router();

        bot.use(botServiceQuickReplyPatch(bot, 'start'));

        bot.use('start', (req, res) => {
            res.text('Foo', {
                bar: 'bar'
            });
        });

        bot.use('bar', (req, res) => {
            res.text('Bar');
        });

        bot.use((req, res) => {
            res.text('No');
        });

        const t = new Tester(bot);

        const req = Request.text(t.senderId, 'bar');
        Object.assign(req, { _conversationId: 'a' });
        await t._request(req);

        t.any().contains('Bar');

    });

});
