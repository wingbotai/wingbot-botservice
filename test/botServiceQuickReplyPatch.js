/*
 * @author David Menger
 */
'use strict';

const { Router, Tester, Request } = require('wingbot');
const assert = require('assert');
const botServiceQuickReplyPatch = require('../src/botServiceQuickReplyPatch');

describe('botServiceQuickReplyPatch()', () => {

    it('should set expected keywords to users with new conversation', async () => {

        const bot = new Router();

        const patch = botServiceQuickReplyPatch(bot, 'start');

        bot.use(patch);

        let callcount = 0;

        bot.use('start', (req, res) => {
            res.text('Foo', {
                bar: 'bar'
            });
            callcount++;
        });

        bot.use('bar', (req, res) => {
            res.text('Bar');
        });

        bot.use((req, res) => {
            res.text('No');
        });

        const t = new Tester(bot);

        await t._request(Object.assign(
            Request.text(t.senderId, 'bar'),
            { _conversationId: 'a' }
        ));

        t.any().contains('Bar');

        assert.equal(callcount, 1);

        t.senderId = '1';
        await t._request(Object.assign(
            Request.text(t.senderId, 'bar'),
            { _conversationId: 'a' }
        ));

        assert.equal(callcount, 1);

        patch(true);

        t.senderId = '2';
        await t._request(Object.assign(
            Request.text(t.senderId, 'bar'),
            { _conversationId: 'a' }
        ));

        assert.equal(callcount, 2);

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

        await t._request(req);

        t.any().contains('any');
    });

});
