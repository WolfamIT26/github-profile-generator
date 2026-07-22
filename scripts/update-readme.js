import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GitHubClient } from './github.js';
import { buildReadme, loadTemplate } from './markdown.js';
import {
  analyzeRepositories,
  assetPath,
  calculateLanguageStats,
  generateContributionCalendarSvg,
  generateContributionSnakeSvg,
  generateLanguageChartSvg,
  generatePortfolioOverviewSvg,
  summarizeRepositoryTotals
} from './stats.js';
import { ensureDir, log, sortByPushedDesc, writeFileIfChanged } from './utils.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USERNAME = process.env.GITHUB_USERNAME || process.env.GH_USERNAME || 'WolfamIT26';
const LATEST_PROJECT_LIMIT = Number(process.env.LATEST_PROJECT_LIMIT || process.env.PROJECT_SECTION_LIMIT || 8);

async function main() {
  log.section(`Generating GitHub Profile README for ${USERNAME}`);
  await ensureDir(path.join(ROOT_DIR, 'assets'));

  const github = new GitHubClient();

  const [user, repositoryPool, pinnedRepos] = await Promise.all([
    loadWithFallback('profile', () => github.getUser(USERNAME), fallbackUser(USERNAME)),
    loadWithFallback('repository pool', () => github.getReadmeRepositoryPool(USERNAME), fallbackRepositoryPool()),
    loadWithFallback('pinned repositories', () => github.getPinnedRepositories(USERNAME), [])
  ]);

  const { organizations, repositories: loadedRepos } = repositoryPool;
  log.info(`loaded ${loadedRepos.length} unique repositories from personal, private, organization, permission, and merged-PR sources`);

  const allRepos = mergeLatestInputs([
    ...loadedRepos,
    ...pinnedRepos.map((repo) => ({
      ...repo,
      sourceTags: [...new Set([...(repo.sourceTags || []), 'pinned'])]
    }))
  ]);

  const enrichedRepos = await github.enrichRepositories(allRepos);
  const { repositories, detectedTech } = analyzeRepositories(enrichedRepos);
  const repoByName = new Map(repositories.map((repo) => [repo.full_name.toLowerCase(), repo]));
  const latestRepos = sortByPushedDesc(repositories)
    .slice(0, LATEST_PROJECT_LIMIT)
    .map((repo) => repoByName.get(repo.full_name.toLowerCase()) || repo);

  const languageStats = calculateLanguageStats(repositories);
  const repositoryTotals = summarizeRepositoryTotals(repositories);
  const contributionCalendar = await github.getContributionCalendar(USERNAME);
  const template = await loadTemplate(ROOT_DIR);

  await Promise.all([
    generatePortfolioOverviewSvg({
      username: USERNAME,
      repositories,
      detectedTech,
      languageStats,
      repositoryTotals
    }, assetPath(ROOT_DIR, 'portfolio-overview.svg')),
    generateLanguageChartSvg(languageStats, assetPath(ROOT_DIR, 'language-chart.svg')),
    generateContributionCalendarSvg(contributionCalendar, assetPath(ROOT_DIR, 'contribution-calendar.svg'), USERNAME),
    generateContributionSnakeSvg(contributionCalendar, assetPath(ROOT_DIR, 'github-contribution-grid-snake.svg'), USERNAME)
  ]);

  const readme = buildReadme({
    template,
    username: USERNAME,
    user,
    organizations,
    latestRepos,
    languageStats,
    detectedTech,
    repositoryTotals,
    projectSectionLimit: LATEST_PROJECT_LIMIT
  });

  await writeFileIfChanged(path.join(ROOT_DIR, 'README.md'), readme);
  log.section('README generation complete');
}

function mergeLatestInputs(repositories) {
  const byName = new Map();

  for (const repo of repositories) {
    const fullName = repo.full_name || repo.nameWithOwner;
    if (!fullName) {
      continue;
    }

    const key = fullName.toLowerCase();
    const current = byName.get(key);
    byName.set(key, current ? mergeReadmeRepo(current, repo) : repo);
  }

  return [...byName.values()].filter((repo) => !repo.archived);
}

function mergeReadmeRepo(current, incoming) {
  return {
    ...current,
    ...incoming,
    sourceTags: [...new Set([...(current.sourceTags || []), ...(incoming.sourceTags || [])])],
    permissions: {
      ...(current.permissions || {}),
      ...(incoming.permissions || {}),
      admin: Boolean(current.permissions?.admin || incoming.permissions?.admin),
      maintain: Boolean(current.permissions?.maintain || incoming.permissions?.maintain),
      push: Boolean(current.permissions?.push || incoming.permissions?.push)
    },
    private: Boolean(current.private || incoming.private),
    hasPushPermission: Boolean(current.hasPushPermission || incoming.hasPushPermission),
    hasAdminPermission: Boolean(current.hasAdminPermission || incoming.hasAdminPermission),
    hasMergedPullRequest: Boolean(current.hasMergedPullRequest || incoming.hasMergedPullRequest),
    hasContribution: Boolean(current.hasContribution || incoming.hasContribution)
  };
}

async function loadWithFallback(label, loader, fallback) {
  try {
    return await loader();
  } catch (error) {
    log.warn(`using fallback for ${label}: ${error.message}`);
    return fallback;
  }
}

function fallbackRepositoryPool() {
  return {
    authLogin: USERNAME,
    organizations: [],
    repositories: []
  };
}

function fallbackUser(username) {
  return {
    login: username,
    name: username,
    avatar_url: `https://github.com/${encodeURIComponent(username)}.png`,
    bio: `GitHub profile for @${username}`,
    followers: 0,
    following: 0,
    public_repos: 0,
    location: '',
    company: '',
    blog: '',
    twitter_username: ''
  };
}

main().catch((error) => {
  log.error(error.stack || error.message);
  process.exitCode = 1;
});
