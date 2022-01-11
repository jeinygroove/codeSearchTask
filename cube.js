// run this after index.js to add point column values for existing code snippets
const readline = require('readline');
const fs = require('fs');
const { Pool, Client } = require('pg')

const pool = new Pool({
    user: 'postgsnippets',
    host: 'localhost',
    database: 'codesearch',
    password: 'postgsnippets',
    port: 5432,
})

const readInterface = readline.createInterface({
    input: fs.createReadStream('model.vec'),
    output: false,
    console: false
});

const tokensEmb = new Map();
const getTokenEmb = async () => {
    for await (const line of readInterface) {
        const lineInfo = line.split(' ');
        const tokenName = lineInfo[0];
        const tokenVec = lineInfo.slice(1).map((n) => Number(n));
        tokensEmb.set(tokenName, tokenVec);
    }
}

const addCube = async () => {
    const snippets = await pool.query(`SELECT id, code, tokens from "snippets"`);
    await Promise.all(snippets.rows.map(async (snippetObj) => {
        const cube = snippetObj.tokens.split(' ').filter((t) => t.length !== 0).reduce((prev, token) => prev.map((v, i) => {
            return v + tokensEmb.get(token)[i]
        }), new Array(100).fill(0)).map((x) => x / 100.0);
        await pool.query(`UPDATE "snippets" set point = cube(array[${cube.join(',')}]) where id = ${snippetObj.id}`);
    }));
}

getTokenEmb().then(() => addCube());
