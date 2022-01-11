const express = require('express');
const port = 3002;
const bodyParser = require('body-parser');
const app = express();
const search = require('./search');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true,
}));

const routes = app => {
    app.post('/', async (request, response) => {
        const resp = await search.searchSimilarSnippets(request.body.snippet);
        response.send(resp);
    });
}

routes(app);

const server = app.listen(port, (error) => {
    if (error) return console.log(`Error: ${error}`);

    console.log(`Server listening on port ${server.address().port}`);
});