Configure:
* copy `example.config.js` to `config.js`
* fill in your blog name, tumblr tokens and tg bot token

Start
* `npm install`
* `node index.js`

Expose bot:
* download ngrok
* run ngrok: `/path/to/ngrok http 3000`
* `curl -F "url=https://<WHATEVER_NGROK_GIVES_YOU>.ngrok.io/new-message"  https://api.telegram.org/bot<TOKEN>/setWebhook`

Now go to your bot in Telegram and say "гав!"