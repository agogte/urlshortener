const express = require('express')
const shortid = require('shortid');
const app = express()
const mongoose = require('mongoose');
const URL = require('./Models/url');
const PORT = 3001

require('dotenv').config()

app.use(express.json())

// connect to db
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
    //listen for requests
    app.listen(PORT, () => {
        console.log(`Connected to DB and Listening on port ${PORT}`)
    })
}).catch((error) => { console.log(error) })

app.get('/hello', (req, res) => {
    res.json('Hello Express')
})

app.get('/:shortID', async (req, res) => {
    const shortID = req.params.shortID
    const entry = await URL.findOne({ shortID })
    res.redirect(entry.redirectURL)
    // res.send(entry.redirectURL)
})

app.put('/', async (req, res) => {
    const body = req.body
    // console.log(body)
    if (!body) return res.status(400).json({ error: 'URL is required' })

    URL.findOne({ redirectURL: body.url })
        .then(async (url) => {
            if (url) res.json({ shortID: url.shortID })
            else {
                const shortID = shortid()
                await URL.create({
                    shortID: shortID,
                    redirectURL: body.url
                })
                console.log(shortID)
                return res.json({ shortID: shortID })
            }
        })

})
