/*
 * @author David Menger
 */
'use strict';

const { Router, Tester, Request } = require('wingbot');
const botServiceQuickReplyPatch = require('../src/botServiceQuickReplyPatch');

describe('botServiceQuickReplyPatch()', () => {

    it('should set expected keywords to users with new conversation', async () => {

        const bot = new Router();

        const patch = botServiceQuickReplyPatch(bot, 'start');

        bot.use(patch);

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

        await t.processMessage(Object.assign(
            Request.text(t.senderId, 'bar'),
            { _conversationId: 'a' }
        ));

        t.any().contains('Bar');

    });

    it('should accept "expected"', async () => {
        const bot = new Router();

        bot.use(botServiceQuickReplyPatch(bot));

        bot.use('start', (req, res) => {
            res.text('Foo', {
                other: 'bar'
            });
            res.expected('bar');
        });

        bot.use('bar', (req, res) => {
            res.text(req.text());
        });

        bot.use('other', (req, res) => {
            res.text('No');
        });

        bot.use((req, res) => {
            res.text('No');
        });

        const t = new Tester(bot);

        const req = Request.text(t.senderId, 'any');

        Object.assign(req, { _conversationId: 'a' });

        await t.processMessage(req);

        t.any().contains('any');
    });

});
