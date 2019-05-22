/*
 * @author David Menger
 */
'use strict';

const request = require('request-promise-native');
const jsonwebtoken = require('jsonwebtoken');
const getPem = require('rsa-pem-from-mod-exp');

const FIVE_DAYS = 432000000;

class RequestValidator {

    /**
     *
     * @param {string} openIdUrl
     * @param {object} options
     * @param {string} options.appId - botservice client id
     * @param {Function} [options.requestLib] - request library replacement
     * @param {string} [options.overPublic] - override public key
     */
    constructor (openIdUrl, options) {
        this._openIdUrl = openIdUrl;

        this._options = options;

        this._request = options.requestLib || request;

        this._cachedOpenIdConfig = null;
        this._cachedOpenIdConfigTs = null;
        this._cachedOpenIdSigningAlgs = null;
    }

    _getUnauthorizedError (message) {
        const err = new Error(`Unauthorized: ${message}`);
        return Object.assign(err, { code: 401, status: 401 });
    }

    async _getPublicKeys () {
        if (this._cachedOpenIdKeys && this._cachedOpenIdConfigTs > Date.now() - FIVE_DAYS) {
            return this._cachedOpenIdKeys;
        }

        const res = await this._request({
            uri: this._openIdUrl,
            json: true
        });

        this._cachedOpenIdSigningAlgs = res.id_token_signing_alg_values_supported;

        const keys = await this._request({
            uri: res.jwks_uri,
            json: true
        });

        this._cachedOpenIdKeys = keys.keys;
        this._cachedOpenIdConfigTs = Date.now();

        return this._cachedOpenIdKeys;
    }

    async _getKey (kid, channelId) {
        const keys = await this._getPublicKeys();

        const key = keys.find(k => k.kid === kid);

        if (!key || !key.n || !key.e) {
            return null;
        }

        if (channelId !== 'emulator'
            && key.endorsements
            && key.endorsements.length !== 0
            && !key.endorsements.includes(channelId)) {

            return null;
        }

        return this._options.overPublic || getPem(key.n, key.e);
    }

    _verify (token, key) {
        return new Promise((resolve, reject) => {
            jsonwebtoken.verify(token, key, {
                algorithms: this._cachedOpenIdSigningAlgs
            }, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    /**
     * Verify Facebook webhook event
     *
     * @param {object} body
     * @param {object} headers
     * @throws {Error} when request is not authorized
     */
    async verifyRequest (body, headers) {
        const signature = headers.Authorization || headers.authorization;
        const [, token = null] = `${signature}`.match(/^Bearer (.+)$/) || [];

        if (!signature || !token) {
            throw this._getUnauthorizedError('Missing or bad Token');
        }

        const decoded = jsonwebtoken.decode(token, { complete: true });

        if (!decoded) {
            throw this._getUnauthorizedError('Invalid token');
        }

        // @ts-ignore
        const { kid = null } = decoded.header || {};

        const { channelId } = body;

        const key = await this._getKey(kid, channelId);

        if (!key) {
            throw this._getUnauthorizedError('Unable to find right key');
        }

        let verified;
        try {
            verified = await this._verify(token, key);
        } catch (e) {
            throw this._getUnauthorizedError('Unable to verify token');
        }

        if (verified.aud !== this._options.appId) {
            throw this._getUnauthorizedError('Unable to verify App Id');
        }
    }

}

module.exports = RequestValidator;
