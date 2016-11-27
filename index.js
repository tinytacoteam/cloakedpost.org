const express = require('express')
const app = express()
const hash = require('hash.js')
const sanitizeHtml = require('sanitize-html')
const ENV = process.env.NODE_ENV || 'development'
const knex = require('knex')(require('./knexfile')[ENV])
const _ = require('lodash')
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json({type: '*/*'})
const CLOAK_SALT = process.env.CLOAK_SALT || 'EtC9szrmx4HDAZg35aW2x4RtwqW3eL7H03I'

function validateId (id) {
  if (id.match(/^[a-z0-9]+$/)) {
    return id
  }
  throw Error('The field `postId` is invalid.')
}

function cleanTitle (title) {
  return sanitizeHtml(title, { allowedTags: [] })
}

function cleanContent (title) {
  return sanitizeHtml(title)
}

function hashPasskey (passkey) {
  return hash.sha512().update(CLOAK_SALT + passkey).digest('hex')
}

function generateId (length = 15) {
  const chars = []
  const possible = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const possibleLen = possible.length
  for (let i = 0; i < length; i++) {
    chars.push(possible.charAt(Math.floor(Math.random() * possibleLen)))
  }

  return chars.join('');
}

app.use(express.static('public'))
app.set('view engine', 'pug')

app.use(function (req, res, next) {
  if (req.accepts('html') && req.method.match(/get/i)) {
    return res.render('index')
  }
  next()
})

app.get('/post', function (req, res) {
  knex('posts')
    .select()
    .orderBy('createdAt', 'DESC')
    .orderByRaw('RANDOM()')
    .limit(10)
    .then((posts) => {
      res.json({
        posts,
      })
    }).catch((err) => {
      console.log('err', err)
      res.sendStatus(500)
    })
})

app.get('/post/:id/:title*?', (req, res) => {
  knex('posts')
    .select()
    .where({
      id: validateId(req.params.id)
    })
    .limit(1)
    .then(([post]) => {
      if (_.isEmpty(post)) {
        return res.sendStatus(404)
      }
      res.json({
        post,
      })
    }).catch((err) => {
      console.log('err', err)
      res.sendStatus(500)
    })
})

app.post('/post', jsonParser, (req, res) => {
  const [name, passkey] = (req.body.name || 'anonymous').split('#')
  knex('posts').insert({
    id: generateId(15),
    name: cleanTitle(name),
    passkey: hashPasskey(passkey),
    title: cleanTitle(req.body.title),
    content: cleanContent(req.body.content),
    createdAt: new Date(),
  })
  .returning('id')
  .then(([id]) => {
    res.status(201).json({
      id,
    })
  }).catch((err) => {
    res.sendStatus(500)
  })
})

app.post('/post/:id/comment', jsonParser, (req, res) => {
  knex('replies').insert({
    id: generateId(20),
    post_id: validateId(req.params.id),
    name: cleanTitle(req.params.name),
    passkey: hashPasskey(req.params.passkey),
    content: cleanTitle(req.params.content),
    createdAt: new Date(),
  }).then(() => {
    res.sendStatus(201)
  }).catch(() => {
    res.sendStatus(500)
  })
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!', ENV)
})
