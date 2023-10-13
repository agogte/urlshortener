const express = require('express')
const shortid = require('shortid');
const app = express()
const mongoose = require('mongoose');
const URL = require('./Models/url');
const PORT = 3001

app.use(express.json())

// connect to db
mongoose.connect('mongodb+srv://agogte:Password123@cluster0.64jgpkw.mongodb.net/?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
    //listen for requests
    app.listen(PORT, () => {
        console.log(`Connected to DB and Listening on port ${PORT}`)
    })
}).catch((error) => {console.log(error)})

app.get('/hello', (req, res) => {
    res.send('Hello Express')
})

app.post('/', async (req, res) => {
    const body = req.body
    console.log(body)
    if(!body) return res.status(400).json({error: 'URL is required'})
    const shortID = shortid()
    await URL.create({
        shortID: shortID,
        redirectURL: body.url
    })
    console.log(shortID)
    return res.json({ id: shortID })
})
