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
## Classes

<dl>
<dt><a href="#BotService">BotService</a></dt>
<dd><p>BotService connector for wingbot.ai</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#botServiceQuickReplyPatch">botServiceQuickReplyPatch(bot, [startAction])</a> ⇒ <code>function</code></dt>
<dd><p>Patch, which solves problem with BotFramework. Always, when conversationId is changed,
middleware looks for matching quick replies from first text request. When there are some,
it redirects user</p>
</dd>
</dl>

<a name="BotService"></a>

## BotService
BotService connector for wingbot.ai

**Kind**: global class  

* [BotService](#BotService)
    * [new BotService(processor, options, [senderLogger])](#new_BotService_new)
    * [.processEvent(body)](#BotService+processEvent) ⇒ <code>Promise.&lt;Array.&lt;{message:Object, pageId:string}&gt;&gt;</code>
    * [.verifyRequest(body, headers)](#BotService+verifyRequest) ⇒ <code>Promise</code>

<a name="new_BotService_new"></a>

### new BotService(processor, options, [senderLogger])

| Param | Type | Description |
| --- | --- | --- |
| processor | <code>Processor</code> | wingbot Processor instance |
| options | <code>Object</code> |  |
| options.appId | <code>string</code> | botservice client id |
| options.appSecret | <code>string</code> | botservice client secret |
| [options.grantType] | <code>string</code> | boservice authentication grant_type |
| [options.scope] | <code>string</code> | boservice authentication scope |
| [options.uri] | <code>string</code> | boservice authentication uri |
| [options.requestLib] | <code>function</code> | request library replacement for testing |
| [options.overPublic] | <code>string</code> | override public key for testing |
| [senderLogger] | <code>console</code> | optional console like chat logger |

<a name="BotService+processEvent"></a>

### botService.processEvent(body) ⇒ <code>Promise.&lt;Array.&lt;{message:Object, pageId:string}&gt;&gt;</code>
Process Facebook request

**Kind**: instance method of [<code>BotService</code>](#BotService)  
**Returns**: <code>Promise.&lt;Array.&lt;{message:Object, pageId:string}&gt;&gt;</code> - - unprocessed events  

| Param | Type | Description |
| --- | --- | --- |
| body | <code>bs.Activity</code> | event body |

<a name="BotService+verifyRequest"></a>

### botService.verifyRequest(body, headers) ⇒ <code>Promise</code>
Verify Facebook webhook event

**Kind**: instance method of [<code>BotService</code>](#BotService)  
**Throws**:

- <code>Error</code> when authorization token is invalid or missing


| Param | Type | Description |
| --- | --- | --- |
| body | <code>Object</code> | parsed request body |
| headers | <code>Object</code> | request headers |

<a name="botServiceQuickReplyPatch"></a>

## botServiceQuickReplyPatch(bot, [startAction]) ⇒ <code>function</code>
Patch, which solves problem with BotFramework. Always, when conversationId is changed,
middleware looks for matching quick replies from first text request. When there are some,
it redirects user

**Kind**: global function  
**Returns**: <code>function</code> - - the middleware  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| bot | <code>Router</code> |  | chatbot itself |
| [startAction] | <code>string</code> | <code>&quot;start&quot;</code> | start action to fetch quick replies |

**Example**  
```javascript
const { Router } = require('wingbot');
const { botServiceQuickReplyPatch } = require('wingbot-botservice');

const bot = new Router();

// attach as first
bot.use(botServiceQuickReplyPatch(bot, 'start'));

bot.use('start', (req, res) => {
    res.text('Hello', {
        goto: 'Go to'
    });
});
```
