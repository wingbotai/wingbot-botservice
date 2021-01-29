/**
 * @author David Menger
 */
'use strict';

const { Router } = require('wingbot');
const request = require('request-promise-native');

/** @typedef {import('wingbot/src/Request')} Request */
/** @typedef {import('wingbot/src/Responder')} Responder */

/**
 *
 * {
 *   "members": [
 *     {
 *       "id": "29:1Rl6kSg0kVpL6l_aJZC1RhA0odYQsfeibIxPxFP-n",
 *       "aadObjectId": "ef929cf6-533a-4e0d-b62b-0dca0bfd33a1",
 *       "name": "John Doe",
 *       "givenName": "John",
 *       "surname": "Doe",
 *       "userPrincipalName": "jonh@mail.ai",
 *       "tenantId": "c20c8290-d1",
 *       "userRole": "user"
 *     }
 *   ]
}
 */

/**
 *
 * @param {Request} req
 * @param {Responder} res
 */
async function loadUserPlugin (req, res) {

    // @ts-ignore
    const conversationId = req._conversationId;
    // @ts-ignore
    const { serviceUrl, conversation } = req.original_event || {};
    const { absToken } = res.data;

    if (!req.state.user && conversationId && absToken
            && conversation && conversation.conversationType === 'personal') {
        try {
            const { members = [] } = await request({
                url: `${serviceUrl.replace(/\/$/, '')}/v3/conversations/${conversationId}/pagedmembers`,
                json: true,
                headers: {
                    Authorization: `Bearer ${absToken}`
                }
            });

            if (members[0]) {
                // name property is used by wingbot designer
                const [user] = members;

                Object.assign(req.state, { user });
                res.setState({ user });
            }

        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('cannot load user from teams', e);
        }
    }

    return Router.CONTINUE;

}

module.exports = loadUserPlugin;
