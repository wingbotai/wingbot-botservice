# Microsoft BotService plugin for wingbot.ai

```javascript
const { Router, Bot } = require('wingbot');
const { BotService } = require('wingbot-botservice');

const bot = new Bot();

const processor = new Processor(bot);

const bs = new BotService(processor, {
    appId: '123',
    appSecret: '456'
});

// the route
module.exports.bot = async (req, res) => {
    const { body, headers } = req;

    await bs.verifyRequest(body, headers);

    await bs.processEvent(bodu);
};

```
-----------------

# API
<a name="BotService"></a>

## BotService
BotService connector for wingbot.ai

**Kind**: global class

* [BotService](#BotService)
    * [new BotService(processor, options, [senderLogger])](#new_BotService_new)
    * [._createSender(body)](#BotService+_createSender)
    * [.processEvent(body)](#BotService+processEvent) ⇒ <code>Promise.&lt;Array.&lt;{message:Object, pageId:string}&gt;&gt;</code>
    * [._getRequestValidator(openIdUrl)](#BotService+_getRequestValidator) ⇒ <code>RequestValidator</code>
    * [.verifyRequest(body, headers)](#BotService+verifyRequest)

<a name="new_BotService_new"></a>

### new BotService(processor, options, [senderLogger])

| Param | Type | Description |
| --- | --- | --- |
| processor | <code>Processor</code> |  |
| options | <code>Object</code> |  |
| options.appId | <code>string</code> | botservice client id |
| options.appSecret | <code>string</code> | botservice client secret |
| [options.grantType] | <code>string</code> | boservice authentication grant_type |
| [options.scope] | <code>string</code> | boservice authentication scope |
| [options.uri] | <code>string</code> | boservice authentication uri |
| [options.requestLib] | <code>function</code> | request library replacement |
| [options.overPublic] | <code>string</code> | override public key |
| [senderLogger] | <code>console</code> | optional console like chat logger |

<a name="BotService+_createSender"></a>

### botservice._createSender(body)
**Kind**: instance method of [<code>BotService</code>](#BotService)

| Param | Type | Description |
| --- | --- | --- |
| body | <code>bs.Activity</code> | event body |

<a name="BotService+processEvent"></a>

### botservice.processEvent(body) ⇒ <code>Promise.&lt;Array.&lt;{message:Object, pageId:string}&gt;&gt;</code>
Process Facebook request

**Kind**: instance method of [<code>BotService</code>](#BotService)
**Returns**: <code>Promise.&lt;Array.&lt;{message:Object, pageId:string}&gt;&gt;</code> - - unprocessed events

| Param | Type | Description |
| --- | --- | --- |
| body | <code>bs.Activity</code> | event body |

<a name="BotService+_getRequestValidator"></a>

### botservice._getRequestValidator(openIdUrl) ⇒ <code>RequestValidator</code>
**Kind**: instance method of [<code>BotService</code>](#BotService)

| Param | Type |
| --- | --- |
| openIdUrl | <code>string</code> |

<a name="BotService+verifyRequest"></a>

### botservice.verifyRequest(body, headers)
Verify Facebook webhook event

**Kind**: instance method of [<code>BotService</code>](#BotService)
**Throws**:

- <code>Error</code> when x-hub-signature does not match body signature


| Param | Type | Description |
| --- | --- | --- |
| body | <code>Object</code> | parsed body |
| headers | <code>Object</code> |  |

