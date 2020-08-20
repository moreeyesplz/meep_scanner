const core = require('@actions/core')
const github = require('@actions/github')
const https = require('https');

// When a number of commits are pushed, each commit message is
// scanned for the tag [MEEP]. If identified, the meep is submitted
// for tracking which will eventually open a meep issue.

const token = core.getInput('github-token');
if (!token) {
    core.setFailed('Workflow input github-token not set. Please add this as specified in the README at https://github.com/moreeyesplz/meep_scanner Thanks!');
    process.exit(1);
}
const octokit = github.getOctokit(token);

function dispatch_meep(commit, repo) {
    return new Promise(async (resolve) => {
        // First, check that themeepbot[bot] hasn't already commented on this
        // commit
        const { data } = await octokit.repos.listCommentsForCommit({
            owner: repo.owner,
            repo: repo.repo,
            commit_sha: commit.id,
        });

        for (let i = 0; i !== data.length; ++i) {
            const comment = data[i];
            if (comment.user.login === 'themeepbot[bot]') {
                // We've already indexed this issue.
                resolve();
                return;
            }
        }

        const body = JSON.stringify({
            user: commit.author.username,
            owner: repo.owner,
            repo: repo.repo,
            message: Buffer.from(commit.message, 'utf8').toString('base64'),
            id: commit.id,
        });
        console.log(body);

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

try {
    const payload = github.context.payload;
    if (!payload.commits) {
        console.log(`No commits detected in payload! ${JSON.stringify(payload, undefined, 2)}`);
        process.exit(0);
    }

    const dispatches = [];

    // Check if this is a public repo
    const is_private = payload.repository.private

    for (let i = 0; i !== payload.commits.length; ++i) {
        const commit = payload.commits[i];

        // Parse commit text for MEEP/meep requests
        const message = commit.message;
        if (message.includes('[MEEP]') || message.includes('[meep]')) {
            if (is_private) {
                core.setFailed(`It looks like you've requested more eyes on a commit but your repository isn't marked "public." Please change the visibility of your repository to "public" in order to meep. Thanks!`);
                process.exit(1);
            }

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