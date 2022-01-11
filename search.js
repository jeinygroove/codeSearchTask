const espree = require("espree");
const sha1 = require("js-sha1");
const fs = require('fs');
const {Pool, Client} = require('pg')
const readline = require("readline");

const getTokenEmb = async () => {
    const readInterface = readline.createInterface({
        input: fs.createReadStream('model.vec'),
        output: false,
        console: false
    });

    const tokensEmb = new Map();

    for await (const line of readInterface) {
        const lineInfo = line.split(' ');
        const tokenName = lineInfo[0];
        const tokenVec = lineInfo.slice(1).map((n) => Number(n));
        tokensEmb.set(tokenName, tokenVec);
    }

    return tokensEmb;
}

const clearSnippet = (AST) => AST.filter(identifier => identifier.type === "Identifier" || identifier.type === "String").map(identifier => {
    return identifier.value.replace(/[.,\/#!$%\^&\*;:{}=\-_`?\"\'\`~()\t]/g, "").replace(/([A-Z])/g, ' $1').toLowerCase().split(" ");
}).join().split(",");

/*
const query = `function _mergeArrays(parts) {
    const result = [];
    parts.forEach((part) => part && result.push(...part));
    return result;
}`;
 */

const search = async (query, tokensEmb) => {
    const pool = new Pool({
        user: 'postgres',
        host: 'localhost',
        database: 'codesearch',
        password: 'postgres',
        port: 5432,
    })

    try {
        const codeAst = espree.tokenize(query.toString(), {
            ecmaVersion: "latest"
        });
        const identifiers = new Set(clearSnippet(codeAst));
        const snippetTokensUnique = [...identifiers];

        const cube = snippetTokensUnique.filter((t) => t.length !== 0).reduce((prev, token) => prev.map((v, i) => {
            return v + tokensEmb.get(token)[i]
        }), new Array(100).fill(0)).map((x) => x / 100.0);

        const res = await pool.query(`
            SELECT code, point FROM snippets
            ORDER BY cube_distance(point, cube(array[${cube.join(',')}]))
            LIMIT 5;`);

        return res.rows.map((row) => row.code);
    } catch (e) {
        console.log('Code is invalid');
    }
    return [];
}

const searchSimilarSnippets = async (query) => {
    return await getTokenEmb().then((tokensEmb) => search(query, tokensEmb));
}

module.exports =  {
    searchSimilarSnippets
}