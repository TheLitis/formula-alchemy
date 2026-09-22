/** First publication only. Uses the user's gh authentication; never reads/stores tokens. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
process.chdir(root);
const args = process.argv.slice(2);
if (args.includes('--help')) {
    console.log('npm run publish:github -- [--repo formula-alchemy] [--owner TheLitis]\nCreates a NEW PUBLIC repository. Existing repositories are never overwritten. Requires git, gh auth login, and npm install. Runs production build, unit/physics and browser tests first.');
    process.exit(0);
}
const options = { repo: 'formula-alchemy', owner: 'TheLitis' };
for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    if (!(key in options) || !args[i + 1])
        throw new Error('Use --repo NAME and/or --owner LOGIN');
    options[key] = args[i + 1];
}
if (!/^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/.test(options.repo) || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(options.owner))
    throw new Error('Invalid repository/account name');
const full = `${options.owner}/${options.repo}`;
function run(binary, argv, { capture = false, allowFailure = false } = {}) {
    const result = spawnSync(binary, argv, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', shell: false });
    if (result.error)
        throw new Error(`${binary}: ${result.error.message}`);
    if (result.status !== 0 && !allowFailure)
        throw new Error(`${binary} ${argv.join(' ')} failed (${result.status}). ${capture ? result.stderr || '' : ''}`);
    return { ok: result.status === 0, text: (result.stdout || '').trim() };
}
const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli))
    throw new Error('Start this script through npm run publish:github');
const npm = (...argv) => run(process.execPath, [npmCli, ...argv]);
run('git', ['--version'], { capture: true });
run('gh', ['auth', 'status']);
const account = JSON.parse(run('gh', ['api', 'user', '--jq', '{login:.login,id:.id}'], { capture: true }).text);
if (account.login.toLowerCase() !== options.owner.toLowerCase())
    throw new Error(`Authenticated as ${account.login}, expected ${options.owner}. No changes made.`);
if (run('gh', ['repo', 'view', full, '--json', 'name'], { capture: true, allowFailure: true }).ok)
    throw new Error(`${full} already exists. This first-publication script will not alter it; use normal git push after reviewing README.`);
const ancestor = run('git', ['rev-parse', '--show-toplevel'], { capture: true, allowFailure: true });
if (ancestor.ok && fs.realpathSync(ancestor.text) !== fs.realpathSync(root))
    throw new Error('Project is inside another Git repository. Extract it to its own directory first.');
if (ancestor.ok && run('git', ['remote'], { capture: true }).text)
    throw new Error('This directory already has a Git remote. Use normal git commands rather than the first-publication helper.');
if (!fs.existsSync(path.join(root, 'package-lock.json')))
    throw new Error('Run npm install first; the generated package-lock.json is required for reproducible publication.');
const require = createRequire(import.meta.url);
try {
    require.resolve('vite');
    require.resolve('matter-js');
}
catch {
    throw new Error('Run npm install first. Dependencies are missing.');
}
console.log(`Verifying source before creating the PUBLIC repository ${full}.`);
npm('run', 'check');
npm('run', 'verify:dist');
npm('exec', '--', 'playwright', 'install', 'chromium');
npm('exec', '--', 'playwright', 'test');
if (!ancestor.ok)
    run('git', ['init', '-b', 'main']);
const branch = run('git', ['branch', '--show-current'], { capture: true }).text;
if (branch !== 'main')
    throw new Error(`Local branch is ${branch}; switch to main explicitly before publishing.`);
if (!run('git', ['config', 'user.name'], { capture: true, allowFailure: true }).ok)
    run('git', ['config', '--local', 'user.name', account.login]);
if (!run('git', ['config', 'user.email'], { capture: true, allowFailure: true }).ok)
    run('git', ['config', '--local', 'user.email', `${account.id}+${account.login}@users.noreply.github.com`]);
// Explicit allowlist, not git add . — unrelated local files are not selected.
run('git', ['add', '--', 'src', 'public', 'tests', 'e2e', 'scripts', 'docs', '.github', '.gitignore', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts', 'README.md', 'LICENSE']);
const staged = run('git', ['diff', '--cached', '--quiet'], { capture: true, allowFailure: true });
if (!staged.ok)
    run('git', ['commit', '-m', 'Build Formula Alchemy physics crafting laboratory']);
run('gh', ['repo', 'create', full, '--public', '--source=.', '--remote=origin', '--description', 'Formula Alchemy — interactive physics crafting laboratory']);
run('git', ['push', '-u', 'origin', 'main']);
// The workflow spends its first job building/testing; Pages is enabled before its deploy job.
const pages = run('gh', ['api', '--method', 'POST', `repos/${full}/pages`, '-f', 'build_type=workflow'], { capture: true, allowFailure: true });
if (!pages.ok) {
    console.error(`Sources have been pushed, but automatic Pages enablement failed. Open https://github.com/${full}/settings/pages and choose Source: GitHub Actions. Then rerun the Pages workflow. No existing content has been overwritten.`);
    process.exitCode = 1;
}
else {
    console.log(`Sources pushed. Follow the deployment result at https://github.com/${full}/actions`);
    console.log(`Expected address AFTER a successful deployment: https://${options.owner.toLowerCase()}.github.io/${options.repo}/`);
    console.log('This command does not claim the site is already live.');
}
