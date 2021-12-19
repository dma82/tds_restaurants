'use strict'

const express = require('express'),
      debug = require('debug')('TDS'),
      bodyParser = require('body-parser'),
      cors = require('cors'),
      utility = new (require('./utils/utility.js'))(),
      database = new (require('./utils/database.js'))();

const port = 3100;
let app = express();
app.use(bodyParser.json());
app.use(cors());

app.post("/search.json", (req, res) => {
    try {
        let dayOfWeek = req.body.dayOfWeek;
        let openAt = req.body.openAt;
        debug(req)
        database.getOpenRestaurants(dayOfWeek, openAt, function(err, data){
            if (err) {
                debug("Error:", err); 
                database.getConnection().end();           
            } else {
                res.send({ result: data });
            }
        })
    } catch (err) {
        res.status(500).send({ result: err });
    }
});

// This is only for testing and it's called by Mocha
function stop() {
    server.close();
}

// Start the server on port 3000
var server = app.listen(port, () => {
    debug(`Listening at http://localhost:${port}`)
    utility.initalize();
    utility.start();
})

module.exports = app;
module.exports.stop = stop;