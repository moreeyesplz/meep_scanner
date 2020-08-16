const core = require('@actions/core')
const github = require('@actions/github')
const https = require('https');

// When a number of commits are pushed, each commit message is
// scanned for the tag [MEEP]. If identified, the meep is submitted
// for tracking which will eventually open a meep issue.

function dispatch_meep(commit, repo) {
    return new Promise((resolve) => {
        const body = JSON.stringify({
            user: commit.author.username,
            repo: repo,
            message: commit.message,
            id: commit.id,
        });

        const req = https.request({
            host: 'us-central1-gentle-cable-286422.cloudfunctions.net',
            path: '/meeper',
            method: 'POST',
            headers: {
                'User-Agent': 'meep-action',
                'Content-Type': 'application/json',
                'Content-Length': body.length,
            }
        }, (res) => {
            res.setEncoding('utf8');
            const chunks = [];
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            res.on('end', () => {
                console.log(chunks.join(''));
                resolve();
            })
        });

        req.write(body);
        req.end();
    })
}

async function meep_label(context) {
    // Check if the MEEP issue label has been created
    const token = core.getInput('github_token', { required: true });
    const octokit = github.getOctokit(token);
    octokit.issues.getLabel({
        owner: context.owner,
        repo: context.repo,
        name: 'MEEP',
    }).then((value) => {
        console.log('MEEP label already created.');
    }).catch((e) => {
        // Label not found. Create it
        octokit.issues.createLabel({
            owner: context.owner,
            repo: context.repo,
            name: 'MEEP',
            color: '3f51b5',
            description: 'More eyes, plz!',
        })
    });
}

try {
    const payload = github.context.payload;
    if (!payload.commits) {
        console.log(`No commits detected in payload! ${JSON.stringify(payload, undefined, 2)}`);
        process.exit(0);
    }

    // NOTE: It appears that the GITHUB_TOKEN provided does not yet permit label creation
    // meep_label(github.context);

    const dispatches = [];

    for (let i = 0; i !== payload.commits.length; ++i) {
        const commit = payload.commits[i];

        // Parse commit text for MEEP requests
        const message = commit.message;
        if (message.includes('[MEEP]')) {
            // Dispatch a cloud function to track the request
            dispatches.push(dispatch_meep(commit, github.context.repo));
        }
    }

    Promise.all(dispatches).then(() => {
        console.log(`${dispatches.length} MEEP${dispatches.length > 1 ? 's' : ''} dispatched!`);
    });
} catch (e) {
    core.setFailed(e.message);
}