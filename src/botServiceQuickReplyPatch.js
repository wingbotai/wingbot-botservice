/*
 * @author David Menger
 */
'use strict';

const { Tester, Router, Request } = require('wingbot');


/**
 * Patch, which solves problem with BotFramework. Always, when conversationId is changed,
 * middleware looks for matching quick replies from first text request. When there are some,
 * it redirects user
 *
 * @param {Router} bot - chatbot itself
 * @param {string} [startAction] - start action to fetch quick replies
 * @returns {Function} - the middleware
 * @example
 * const { Router } = require('wingbot');
 * const { botServiceQuickReplyPatch } = require('wingbot-botservice');
 *
 * const bot = new Router();
 *
 * // attach as first
 * bot.use(botServiceQuickReplyPatch(bot, 'start'));
 *
 * bot.use('start', (req, res) => {
 *     res.text('Hello', {
 *         goto: 'Go to'
 *     });
 * });
 */
function botServiceQuickReplyPatch (bot, startAction = 'start') {

    let cachedStartup;

    async function loadStartupExpected () {
        const t = new Tester(bot);

        try {
            await t.postBack(startAction);

            const { state } = t.getState();

            return {
                expected: state._expected || null,
                keywords: state._expectedKeywords || []
            };

        } catch (e) {
            console.warn('Failed to load expected keywords for startup'); // eslint-disable-line
            return {
                expected: null,
                keywords: []
            };
        }

    }

    async function getStartupExpectedKeywords () {
        if (!cachedStartup) {
            cachedStartup = loadStartupExpected();
        }
        return cachedStartup;
    }

    return async (req, res, postBack) => {
        if (typeof req.data._conversationId === 'undefined'
            || req.state._conversationId === req.data._conversationId) {

            return Router.CONTINUE;
        }

        res.setState({ _conversationId: req.data._conversationId });

        if (req.isText() && !req.isQuickReply()) {
            const expect = await getStartupExpectedKeywords();

            const text = req.text();

            const match = expect.keywords.find(ex => ex.title === text);

            if (match) {
                postBack(match.action, match.data);
                return Router.END;
            } else if (expect.expected) {
                const payload = JSON.stringify(expect.expected);
                const action = Request.quickReplyText(req.senderId, req.text(), payload);
                postBack(action);
                return Router.END;
            }
        }

        return Router.CONTINUE;
    };
}

module.exports = botServiceQuickReplyPatch;
