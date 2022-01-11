const espree = require("espree");
const sha1 = require('js-sha1');
const csvsync = require('csvsync');
const fs = require('fs');
const {Pool, _} = require('pg')

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'codesearch',
    password: 'postgres',
    port: 5432,
})

const clearSnippet = (AST) => AST.filter(identifier => identifier.type === "Identifier" || identifier.type === "String").map(identifier => {
    return identifier.value.replace(/[\/#!?$%&\^\*\"\'\`{}=\-_`~().,;:\t]/g, "").replace(/([A-Z])/g, ' $1').toLowerCase().split(" ");
}).join().split(",");

const getSnippets = () => {
    const csv = fs.readFileSync('data.csv');
    return csvsync.parse(csv).map((r) => r[0]);
}

const tokenizeSnippets = async () => {
    const snippets = getSnippets();
    let isValidSnippet = [];
    let tokens = [];
    let hashes = [];

    snippets.forEach((code) => {
        try {
            const codeAst = espree.tokenize(code.toString(), {
                ecmaVersion: "latest"
            });
            const tokens = new Set(clearSnippet(codeAst));
            const uniqueTokens = [...tokens];
            tokens.push(uniqueTokens.join(" "));
            hashes.push(sha1(uniqueTokens));
            isValidSnippet.push(true);
        } catch (e) {
            isValidSnippet.push(false);
        }
    });

    // file with tokens for fasttext
    const tokensFile = fs.createWriteStream('functions.txt');
    tokensFile.write(tokens.join('\n'));

    // number of invalid snippets (failed to parse with espree or insert to database due to invalid characters
    let invalidSnippets = 0;
    const rows = snippets.filter((_, i) => isValidSnippet[i]).map((s, i) => `(DEFAULT, '${s}', '${tokens[i]}', '${hashes[i]}')`).slice(1);
    for (const i in rows) {
        try {
            await pool.query(`INSERT INTO "snippets" VALUES ${rows[i]};`)
        } catch (e) {
            invalidSnippets++;
        }
    }
    console.log(invalidSnippets);
    await pool.end()
}

tokenizeSnippets();