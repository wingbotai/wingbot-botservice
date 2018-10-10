/*
 * @author David Menger
 */
'use strict';

const { Request } = require('wingbot');

const KNOWN_TYPES = ['image', 'audio', 'video'];

/**
 *
 * @param {bs.Activity} body
 * @param {Object|null} req
 */
function parseAttachments (body, req) {
    if (!body.attachments && !body.entities) {
        return req;
    }

    let res = req;

    const attachments = (body.attachments || [])
        .map((at) => {
            let [type = null] = `${at.contentType}`
                .match((/^([a-z0-9-*+]+)\/([a-z0-9-*+]+)$/i)) || [];

            if (!KNOWN_TYPES.includes(type)) {
                type = 'file';
            }

            if (!at.contentUrl) {
                console.warn('Missing content url at attachment', at); // eslint-disable-line
                return null;
            }

            return {
                type,
                payload: {
                    url: at.contentUrl
                }
            };
        })
        .filter(at => at !== null);

    const locations = (body.entities || [])
        .filter(ent => ent.type === 'Place')
        .map(ent => ({
            type: 'location',
            payload: {
                coordinates: {
                    // @ts-ignore
                    lat: ent.geo.latitude,
                    // @ts-ignore
                    long: ent.geo.longitude
                }
            }
        }));

    // @ts-ignore
    attachments.push(...locations);

    if (attachments.length === 0) {
        return res;
    }

    if (!res) {
        res = Request.fileAttachment(body.from.id, 'foo');
    }

    Object.assign(res.message, { attachments });

    return res;
}

module.exports = parseAttachments;
