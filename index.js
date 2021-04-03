const tumblr = require('tumblr.js');
const fs = require('fs');
const express = require('express');
const app = express();
const axios = require('axios');
const config = require('./config')

const tg = config.telegram;
const blogName = config.tumblr.blog_name;

const client = tumblr.createClient(config.tumblr);

let totalPosts;
let numberOfChunks;
let allTags = [];
let tagsWithCount = {};

function getTags(chunk = 0) {
    const offset = 20 * chunk; // api returns 20 posts at a time
    client.blogPosts(blogName, { offset: offset }, (err, resp) => {
        if (err) throw err;
        if (totalPosts === undefined) {
            totalPosts = resp.total_posts;
            numberOfChunks = Math.ceil(totalPosts / 20);
        }
        console.log(`processing chunk ${chunk} out of ${numberOfChunks}`);
        let tagsFromBatch = resp.posts.reduce((arr, post) => [...arr, ...post.tags], []);
        allTags = [...allTags, ...tagsFromBatch];
        if (chunk < numberOfChunks) {
            getTags(chunk + 1);
        } else {
            finishGettingTags();
        }
    });
}

function finishGettingTags() {
    const dedupedTags = new Set(allTags);
    console.log(dedupedTags);
}

function getTagsWithCount(chunk = 0) {
    const offset = 20 * chunk; // api returns 20 posts at a time
    client.blogPosts(blogName, { offset: offset }, (err, resp) => {
        if (err) throw err;
        if (totalPosts === undefined) {
            totalPosts = resp.total_posts;
            numberOfChunks = Math.ceil(totalPosts / 20);
        }
        console.log(`processing chunk ${chunk} out of ${numberOfChunks}`);
        for (const post of resp.posts) {
            for (const tag of post.tags) {
                if (tag in tagsWithCount) {
                    tagsWithCount[tag]++;
                } else {
                    tagsWithCount[tag] = 1;
                }
            }
        }
        if (chunk < numberOfChunks) {
            getTagsWithCount(chunk + 1);
        } else {
            finishGettingTagsWithCount();
        }
    });
}

function finishGettingTagsWithCount() {
    console.log(tagsWithCount);
}

function getOriginalSizeImageURLsByTag(tag, callback) {
    client.blogPosts(blogName, {
        tag: tag
    }, (err, resp) => {
        if (err) throw err;
        const photos = resp.posts.reduce((arr, post) => [...arr, ...post.photos], []);
        const originalSizes = photos.map(photo => photo.original_size.url);
        callback(originalSizes);
    });
}

function downloadAndSaveImage(uri, callback = () => { }) {
    const filename = uri.split('/').pop();
    request.head(uri, function (err, res, body) {
        if (err) throw err;
        console.log('content-type:', res.headers['content-type']);
        console.log('content-length:', res.headers['content-length']);
        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
};

function downloadAndRespondWithImage(uri, res) {
    request.head(uri, function (err, apiRes) {
        if (err) throw err;
        console.log('content-type:', apiRes.headers['content-type']);
        console.log('content-length:', apiRes.headers['content-length']);
        res.setHeader('content-type', apiRes.headers['content-type']);
        res.setHeader('content-length', apiRes.headers['content-type']);
        request(uri).pipe(res);
    });
}

function replaceTag(from, to) {
    client.blogPosts(blogName, {
        tag: from
    }, (err, resp) => {
        if (err) throw err;
        console.log(`going to replace tag in ${resp.posts.length} posts`);
        for (const post of resp.posts) {
            client.editPost(blogName, {
                id: post.id,
                tags: post.tags.join(',').replace(from, to)
            }, (err, resp) => {
                if (err) throw err;
                console.log(resp);
            })
        }
    });
}

function getNumPostsByTag(tag, callback) {
    client.blogPosts(blogName, {
        tag: tag
    }, (err, resp) => {
        if (err) throw err;
        callback(resp.total_posts);
    });
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

function getRandomFromArray(arr) {
    return arr[getRandomInt(arr.length)];
}

function getRandomPhotoUrl(callback) {
    client.blogPosts(blogName, (err, resp) => {
        if (err) throw err;

        const totalPosts = resp.total_posts;
        const randomPostNumber = getRandomInt(totalPosts);
        console.log(`chose post ${randomPostNumber} of ${totalPosts}`);

        client.blogPosts(blogName, {
            limit: 1,
            offset: randomPostNumber
        }, (err, resp) => {
            if (err) throw err;
            const photos = resp.posts[0].photos;
            console.log(`choosing random photo of ${photos.length} photos in the post`);
            const photo = getRandomFromArray(photos);
            const photoUrl = photo.original_size.url;
            console.log(photoUrl);    
            callback(photoUrl);
        });
    });
}

function isGif(url) {
    return url.slice(-4).toLowerCase() === '.gif';
}

function getTgCommand(url) {
    return `https://api.telegram.org/bot${tg.bot_token}/send${isGif(url) ? 'Animation' : 'Photo'}`;
}

function getTgPayload(chatId, url) {
    const payload = {
        chat_id: chatId
    };
    if (isGif(url)) {
        payload.animation = url;
    } else {
        payload.photo = url;
    }
    console.log('payload is', payload);
    return payload;
}

function postImageToTelegram(chatId, url) {
    return axios.post(getTgCommand(url), getTgPayload(chatId, url));
}

function postTextToTelegram(chatId, text) {
    return axios.post(`https://api.telegram.org/bot${tg.bot_token}/sendMessage`, {
        chat_id: chatId,
        text: text
    });
}

function startTelegramBot() {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
    
    // here's the endpoint telegram will call
    app.post('/new-message', function (req, res) {
        console.log('got a message from tg:');
        console.log(req.body);
        const message = req.body.message || req.body.edited_message;
        let chatId;
        if (!message) {
            console.log('Cannot find message in req.body');
            console.log(req);
        }
        if (message.chat) {
            chatId = message.chat.id;
        } else {
            console.log(message);
            throw new Error('Cannot find chat ID in message from tg');
        }
        
        if (message.text !== 'гав!') {
            console.log(`message text is "${message.text}", rejecting`);
            postTextToTelegram(chatId, `«${message.text}» не подходит, скажи «гав!»`);
            res.end('ok');
            return;
        }

        getRandomPhotoUrl(url => {
            postImageToTelegram(chatId, url)
            .then(() => {
                console.log('photo posted');
                res.end('ok');
            }).catch(err => {
                console.log('Error :', err);
                res.end('Error :' + err);
            });
        });
        
    });
    
    // Finally, start our server
    app.listen(3000, function () {
        console.log("listening on port 3000!")
    })
}

//////////

startTelegramBot();
