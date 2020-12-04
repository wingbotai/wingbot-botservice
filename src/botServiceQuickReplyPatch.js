/*
 * @author David Menger
 */
'use strict';

const {
    Tester, Router, Request, quickReplyAction, ai, getSetState
} = require('wingbot');

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
 * const patch = botServiceQuickReplyPatch(bot, 'start');
 * bot.use(patch);
 *
 * bot.use('start', (req, res) => {
 *     res.text('Hello', {
 *         goto: 'Go to'
 *     });
 * });
 */
function botServiceQuickReplyPatch (bot, startAction = 'start') {

    let cachedStartup = null;

    bot.on('rebuild', () => {
        cachedStartup = null;
    });

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
        if (cachedStartup === null) {
            cachedStartup = loadStartupExpected();
        }
        return cachedStartup;
    }

    return async (req, res, postBack) => {

        if (typeof req.event._conversationId === 'undefined'
            || req.state._conversationId === req.event._conversationId) {

            return Router.BREAK;
        }

        res.setState({ _conversationId: req.event._conversationId });

        if (req.isText() && !req.isQuickReply()) {
            const expect = await getStartupExpectedKeywords();

            const match = quickReplyAction(expect.keywords, req, ai);

            if (match) {
                const {
                    _aiKeys: aiKeys = [], setState, action, data
                } = match;

                if (setState) {
                    const aiSetState = {};
                    const otherSetState = {};
                    const ss = getSetState(setState, req, res);
                    Object.keys(setState)
                        .forEach((k) => {
                            if (aiKeys.includes(k)) {
                                Object.assign(aiSetState, { [k]: ss[k] });
                            } else {
                                Object.assign(otherSetState, { [k]: ss[k] });
                            }
                        });

                    ai.processSetStateEntities(req, otherSetState);
                    Object.assign(req.state, otherSetState, aiSetState);
                    res.setState({ ...otherSetState, ...aiSetState });
                }
                postBack(action, data);
                return Router.END;
            }

            if (expect.expected) {
                const { action, data } = expect.expected;
                res.expected(action, data);
                const request = Request.text(req.senderId, req.text());
                postBack(request);
                return Router.END;
            }
        }

        return Router.BREAK;
    };
}

module.exports = botServiceQuickReplyPatch;
