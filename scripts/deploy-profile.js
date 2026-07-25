import 'dotenv/config';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { ensureDir, log } from './utils.js';

const execFileAsync = promisify(execFile);
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_REPOSITORY = process.env.PROFILE_REPOSITORY || 'WolfamIT26/WolfamIT26';
const PROFILE_OUTPUT_DIR = path.resolve(ROOT_DIR, process.env.PROFILE_OUTPUT_DIR || 'dist/profile');
const COMMIT_MESSAGE = process.env.PROFILE_COMMIT_MESSAGE || 'docs: update generated profile README';
const BOT_NAME = process.env.GIT_AUTHOR_NAME || 'github-actions[bot]';
const BOT_EMAIL = process.env.GIT_AUTHOR_EMAIL || '41898282+github-actions[bot]@users.noreply.github.com';

/**
 * Deploys generated README and assets to the GitHub profile repository.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const token = process.env.GH_TOKEN;

  if (!token) {
    throw new Error('GH_TOKEN is required to clone and push the profile repository.');
  }

  await assertGeneratedProfile(PROFILE_OUTPUT_DIR);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'github-profile-deploy-'));
  const profileRepoDir = path.join(tempRoot, 'profile');

  try {
    log.section(`Deploying generated profile to ${PROFILE_REPOSITORY}`);
    await cloneProfileRepository({ token, repository: PROFILE_REPOSITORY, targetDir: profileRepoDir });
    await replaceGeneratedFiles({ sourceDir: PROFILE_OUTPUT_DIR, targetDir: profileRepoDir });

    const changed = await hasProfileChanges(profileRepoDir);
    if (!changed) {
      log.info('profile repository already contains the generated README and assets');
      return;
    }

    await configureGit(profileRepoDir);
    await runGit(['add', 'README.md', 'assets'], { cwd: profileRepoDir, label: 'stage generated profile files' });
    await runGit(['commit', '-m', COMMIT_MESSAGE], { cwd: profileRepoDir, label: 'commit generated profile files' });
    await runGit(withAuthHeader(token, ['push']), { cwd: profileRepoDir, label: 'push generated profile files' });
    log.info(`deployed README.md and assets to ${PROFILE_REPOSITORY}`);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

/**
 * Verifies the generator produced the files expected by the deploy step.
 *
 * @param {string} outputDir
 * @returns {Promise<void>}
 */
async function assertGeneratedProfile(outputDir) {
  const readmePath = path.join(outputDir, 'README.md');
  const assetsDir = path.join(outputDir, 'assets');

  await fs.access(readmePath);
  const assets = await fs.readdir(assetsDir);

  if (!assets.some((file) => file.endsWith('.svg'))) {
    throw new Error(`No generated SVG assets found in ${path.relative(ROOT_DIR, assetsDir)}.`);
  }
}

/**
 * Clones the target profile repository with an HTTP auth header so the token is
 * not embedded in the remote URL or logged by git.
 *
 * @param {{ token: string, repository: string, targetDir: string }} input
 * @returns {Promise<void>}
 */
async function cloneProfileRepository({ token, repository, targetDir }) {
  await ensureDir(path.dirname(targetDir));
  await runGit(withAuthHeader(token, [
    'clone',
    '--depth',
    '1',
    `https://github.com/${repository}.git`,
    targetDir
  ]), { label: 'clone profile repository' });
}

/**
 * Replaces the README and assets directory inside the profile repository clone.
 *
 * @param {{ sourceDir: string, targetDir: string }} input
 * @returns {Promise<void>}
 */
async function replaceGeneratedFiles({ sourceDir, targetDir }) {
  await fs.copyFile(path.join(sourceDir, 'README.md'), path.join(targetDir, 'README.md'));
  await fs.rm(path.join(targetDir, 'assets'), { recursive: true, force: true });
  await fs.cp(path.join(sourceDir, 'assets'), path.join(targetDir, 'assets'), { recursive: true });
}

/**
 * Returns true when README.md or assets have changed in the cloned profile repo.
 *
 * @param {string} repositoryDir
 * @returns {Promise<boolean>}
 */
async function hasProfileChanges(repositoryDir) {
  const { stdout } = await runGit(['status', '--porcelain', '--', 'README.md', 'assets'], {
    cwd: repositoryDir,
    label: 'check profile changes'
  });

  return stdout.trim().length > 0;
}

/**
 * Configures commit identity for the generated profile commit.
 *
 * @param {string} repositoryDir
 * @returns {Promise<void>}
 */
async function configureGit(repositoryDir) {
  await runGit(['config', 'user.name', BOT_NAME], { cwd: repositoryDir, label: 'configure git user.name' });
  await runGit(['config', 'user.email', BOT_EMAIL], { cwd: repositoryDir, label: 'configure git user.email' });
}

/**
 * Adds a GitHub HTTPS authorization header to a git command.
 *
 * @param {string} token
 * @param {string[]} args
 * @returns {string[]}
 */
function withAuthHeader(token, args) {
  const encodedToken = Buffer.from(`x-access-token:${token}`).toString('base64');
  return ['-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${encodedToken}`, ...args];
}

/**
 * Executes git with sanitized error output.
 *
 * @param {string[]} args
 * @param {{ cwd?: string, label: string }} options
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
async function runGit(args, { cwd = ROOT_DIR, label }) {
  try {
    return await execFileAsync('git', args, {
      cwd,
      maxBuffer: 1024 * 1024 * 10
    });
  } catch (error) {
    const stdout = redactSecrets(error.stdout || '');
    const stderr = redactSecrets(error.stderr || '');
    const details = [stderr, stdout].filter(Boolean).join('\n').trim();
    throw new Error(`${label} failed${error.code ? ` with exit code ${error.code}` : ''}${details ? `:\n${details}` : ''}`);
  }
}

function redactSecrets(value) {
  return String(value).replace(/AUTHORIZATION: basic [A-Za-z0-9+/=]+/gi, 'AUTHORIZATION: basic [redacted]');
}

main().catch((error) => {
  log.error(error.stack || error.message);
  process.exitCode = 1;
});
