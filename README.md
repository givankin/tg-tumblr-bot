I created this to play with Telegram Bots and Tumblr APIs at the same time. Can be used as a simple example to boostrap a node-based tg bot. To run it, follow the instruction below.

Configure:
* copy `example.config.js` to `config.js`
* fill in your blog name, tumblr tokens and tg bot token

Start:
* `npm install`
* `node index.js`

Expose bot (I am using https://ngrok.com/ because I like it, but you don't have to):
* download ngrok
* run ngrok: `/path/to/ngrok http 3000`
* `curl -F "url=https://<WHATEVER_NGROK_GIVES_YOU>.ngrok.io/new-message"  https://api.telegram.org/bot<TOKEN>/setWebhook`

Now go to your bot in Telegram and use one of the supported commands:
* say "гав!" to display a random image from the blog.