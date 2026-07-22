import axios from 'axios';
import { JsonCache } from './cache.js';
import {
  decodeBase64,
  extractUrls,
  log,
  mapLimit,
  parseLastPageFromLinkHeader,
  sleep,
  uniqueBy
} from './utils.js';

const REST_BASE_URL = 'https://api.github.com';
const GRAPHQL_URL = 'https://api.github.com/graphql';
const API_VERSION = '2022-11-28';
const MAX_RETRIES = 4;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const ANALYSIS_FILES = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  'Cargo.toml',
  'go.mod',
  'pubspec.yaml',
  'Gemfile',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'composer.json',
  'Makefile',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'angular.json',
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tsconfig.json',
  'next.config.js',
  'next.config.cjs',
  'next.config.mjs',
  'nuxt.config.js',
  'nuxt.config.ts',
  'vite.config.js',
  'vite.config.ts',
  'webpack.config.js',
  'webpack.config.cjs',
  'firebase.json',
  'appsettings.json'
];

export class GitHubClient {
  constructor({ token = process.env.GH_TOKEN, rootDir = process.cwd() } = {}) {
    this.token = token || '';
    this.cache = new JsonCache({ rootDir });
    this.rest = axios.create({
      baseURL: REST_BASE_URL,
      timeout: 25000,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': API_VERSION,
        'User-Agent': 'github-profile-readme-auto-generator',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
      }
    });

    if (!this.token) {
      log.warn('GH_TOKEN is not set. Public REST data will work, but GraphQL-only features use fallbacks.');
    }
  }

  async request(config, attempt = 1) {
    const method = (config.method || 'GET').toUpperCase();
    const cacheKey = method === 'GET' ? buildCacheKey(config) : null;

    if (cacheKey) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.rest.request(config);
      if (cacheKey) {
        await this.cache.set(cacheKey, {
          data: response.data,
          headers: pickCacheHeaders(response.headers),
          status: response.status
        });
      }

      return response;
    } catch (error) {
      const response = error.response;
      const status = response?.status;
      const retryAfter = Number(response?.headers?.['retry-after'] || 0);
      const rateRemaining = Number(response?.headers?.['x-ratelimit-remaining'] ?? 1);
      const rateReset = Number(response?.headers?.['x-ratelimit-reset'] || 0) * 1000;
      const requestLabel = `${config.method || 'GET'} ${config.url}`;

      // Authenticated Action runs can wait briefly for rate-limit recovery. Local
      // unauthenticated runs fail fast so the generator can produce a fallback README.
      if (status === 403 && rateRemaining === 0 && rateReset > Date.now()) {
        const waitMs = rateReset - Date.now() + 1500;

        if (!this.token && waitMs > 60 * 1000) {
          throw new Error(
            `GitHub unauthenticated rate limit reached for ${requestLabel}; set GH_TOKEN to continue immediately`
          );
        }

        const boundedWaitMs = Math.min(waitMs, 15 * 60 * 1000);
        log.warn(`rate limit reached for ${requestLabel}; waiting ${Math.ceil(boundedWaitMs / 1000)}s`);
        await sleep(boundedWaitMs);
        return this.request(config, attempt);
      }

      if ((RETRYABLE_STATUSES.has(status) || !response) && attempt <= MAX_RETRIES) {
        const backoffMs = retryAfter ? retryAfter * 1000 : Math.min(1500 * 2 ** (attempt - 1), 12000);
        log.warn(`${requestLabel} failed with ${status || 'network error'}; retrying in ${backoffMs}ms`);
        await sleep(backoffMs);
        return this.request(config, attempt + 1);
      }

      const details = response?.data?.message || error.message;
      throw new Error(`GitHub API ${requestLabel} failed (${status || 'network'}): ${details}`);
    }
  }

  async safeRequest(config, fallback, label) {
    try {
      const response = await this.request(config);
      return response.data;
    } catch (error) {
      log.warn(`${label}: ${error.message}`);
      return fallback;
    }
  }

  async getAllPages(url, params = {}) {
    const items = [];
    let page = 1;

    while (true) {
      const response = await this.request({
        method: 'GET',
        url,
        params: {
          per_page: 100,
          ...params,
          page
        }
      });

      const data = Array.isArray(response.data) ? response.data : [];
      items.push(...data);

      const hasNext = response.headers.link?.includes('rel="next"');
      if (!hasNext || data.length === 0) {
        break;
      }

      page += 1;
    }

    return items;
  }

  async getUser(username) {
    const response = await this.request({
      method: 'GET',
      url: `/users/${username}`
    });

    return response.data;
  }

  async getAuthenticatedUser() {
    if (!this.token) {
      return null;
    }

    return this.safeRequest(
      {
        method: 'GET',
        url: '/user'
      },
      null,
      'authenticated user'
    );
  }

  async getUserRepositories(username) {
    return this.getAllPages(`/users/${username}/repos`, {
      sort: 'updated',
      direction: 'desc',
      type: 'owner'
    });
  }

  async getAuthenticatedRepositories() {
    if (!this.token) {
      return [];
    }

    return this.getAllPages('/user/repos', {
      affiliation: 'owner,collaborator,organization_member',
      visibility: 'all',
      sort: 'pushed',
      direction: 'desc'
    });
  }

  async getOrganizations(username) {
    return this.getAllPages(`/users/${username}/orgs`);
  }

  async getOrganizationRepositories(orgLogin) {
    return this.getAllPages(`/orgs/${orgLogin}/repos`, {
      type: 'public',
      sort: 'updated',
      direction: 'desc'
    });
  }

  async hasUserCommit(fullName, username) {
    const commits = await this.safeRequest(
      {
        method: 'GET',
        url: `/repos/${fullName}/commits`,
        params: {
          author: username,
          per_page: 1
        }
      },
      [],
      `commit lookup for ${fullName}`
    );

    return Array.isArray(commits) && commits.length > 0;
  }

  async getUserOrganizationRepositories(username, organizations) {
    const groups = await mapLimit(organizations, 2, async (org) => {
      log.info(`fetching organization repositories from ${org.login}`);
      const repos = await this.getOrganizationRepositories(org.login);
      const publicActiveRepos = repos.filter((repo) => !repo.archived);

      // A repo is considered a team project when the token exposes push-like
      // permissions or when the public commit API shows this user as an author.
      const contributedRepos = await mapLimit(publicActiveRepos, 4, async (repo) => {
        const hasPushAccess = Boolean(
          repo.permissions?.admin ||
          repo.permissions?.maintain ||
          repo.permissions?.push
        );

        if (hasPushAccess) {
          return repo;
        }

        return (await this.hasUserCommit(repo.full_name, username)) ? repo : null;
      });

      return contributedRepos.filter(Boolean);
    });

    return uniqueBy(groups.flat(), (repo) => repo.full_name);
  }

  async getMergedPullRequestRepositories(username) {
    if (!this.token) {
      return [];
    }

    const queries = [
      `is:pr is:merged author:${username}`,
      `is:pr is:merged merged-by:${username}`
    ];
    const searchResults = await mapLimit(queries, 1, (query) => this.searchIssues(query, 10));
    const repoUrls = uniqueBy(
      searchResults
        .flat()
        .map((item) => item.repository_url)
        .filter(Boolean),
      (url) => url
    );

    const repos = await mapLimit(repoUrls, 4, async (repoUrl) => {
      const apiPath = new URL(repoUrl).pathname;
      const repo = await this.safeRequest(
        {
          method: 'GET',
          url: apiPath
        },
        null,
        `merged pull request repository ${apiPath}`
      );

      return repo ? addSourceTags(repo, ['merged-pr']) : null;
    });

    return repos.filter(Boolean);
  }

  async getCommittedRepositories(username) {
    if (!this.token) {
      return [];
    }

    const commits = await this.searchCommits(`author:${username}`, 5);
    return uniqueBy(
      commits
        .map((item) => item.repository)
        .filter(Boolean)
        .map((repo) => addSourceTags(repo, ['contributed'])),
      (repo) => repo.full_name
    );
  }

  async searchCommits(query, maxPages = 5) {
    const items = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const data = await this.safeRequest(
        {
          method: 'GET',
          url: '/search/commits',
          params: {
            q: query,
            sort: 'committer-date',
            order: 'desc',
            per_page: 100,
            page
          }
        },
        { items: [] },
        `commit search "${query}"`
      );

      items.push(...(data.items || []));

      if (!data.items || data.items.length < 100) {
        break;
      }
    }

    return items;
  }

  async searchIssues(query, maxPages = 10) {
    const items = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const data = await this.safeRequest(
        {
          method: 'GET',
          url: '/search/issues',
          params: {
            q: query,
            sort: 'updated',
            order: 'desc',
            per_page: 100,
            page
          }
        },
        { items: [] },
        `issue search "${query}"`
      );

      items.push(...(data.items || []));

      if (!data.items || data.items.length < 100) {
        break;
      }
    }

    return items;
  }

  async getReadmeRepositoryPool(username) {
    const authenticatedUser = await this.getAuthenticatedUser();
    const authLogin = authenticatedUser?.login || username;

    if (authenticatedUser && authLogin.toLowerCase() !== username.toLowerCase()) {
      log.warn(`GH_TOKEN belongs to ${authLogin}; permission-based repository loading will use that account.`);
    }

    const [personalRepos, authenticatedRepos, organizations, mergedPullRequestRepos, committedRepos] = await Promise.all([
      this.getUserRepositories(username),
      this.getAuthenticatedRepositories(),
      this.getOrganizations(username),
      this.getMergedPullRequestRepositories(authLogin),
      this.getCommittedRepositories(authLogin)
    ]);

    const accessibleRepos = process.env.INCLUDE_PRIVATE_REPOS === '0'
      ? authenticatedRepos.filter((repo) => !repo.private)
      : authenticatedRepos;
    const organizationRepos = await this.getUserOrganizationRepositories(username, organizations);
    const ownedRepos = accessibleRepos.filter((repo) => isOwner(repo, username) || isOwner(repo, authLogin));
    const privateRepos = accessibleRepos.filter((repo) => repo.private);
    const authOrganizationRepos = accessibleRepos.filter((repo) => isOrganizationRepository(repo, username, authLogin));
    const pushRepos = accessibleRepos.filter((repo) => Boolean(repo.permissions?.push || repo.permissions?.maintain));
    const adminRepos = accessibleRepos.filter((repo) => Boolean(repo.permissions?.admin));

    const repositories = mergeRepositories([
      ...withSourceTags(personalRepos, ['personal']),
      ...withSourceTags(ownedRepos, ['personal']),
      ...withSourceTags(privateRepos, ['private']),
      ...withSourceTags(organizationRepos, ['organization']),
      ...withSourceTags(authOrganizationRepos, ['organization']),
      ...withSourceTags(pushRepos, ['push']),
      ...withSourceTags(adminRepos, ['admin']),
      ...withSourceTags(mergedPullRequestRepos, ['merged-pr']),
      ...withSourceTags(committedRepos, ['contributed'])
    ]).filter((repo) => !repo.archived);

    return {
      authLogin,
      organizations,
      repositories
    };
  }

  async graphql(query, variables = {}) {
    if (!this.token) {
      return null;
    }

    const cacheKey = `GRAPHQL ${JSON.stringify({ query, variables })}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await axios.post(
        GRAPHQL_URL,
        { query, variables },
        {
          timeout: 25000,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'github-profile-readme-auto-generator'
          }
        }
      );

      if (response.data.errors?.length) {
        throw new Error(response.data.errors.map((error) => error.message).join('; '));
      }

      await this.cache.set(cacheKey, response.data.data);
      return response.data.data;
    } catch (error) {
      const details = error.response?.data?.message || error.message;
      log.warn(`GraphQL request failed: ${details}`);
      return null;
    }
  }

  async getPinnedRepositories(username) {
    const data = await this.graphql(
      `
      query PinnedRepositories($login: String!) {
        user(login: $login) {
          pinnedItems(first: 6, types: REPOSITORY) {
            nodes {
              ... on Repository {
                name
                nameWithOwner
                description
                url
                homepageUrl
                stargazerCount
                forkCount
                isArchived
                isFork
                updatedAt
                pushedAt
                openIssues: issues(states: OPEN) {
                  totalCount
                }
                defaultBranchRef {
                  name
                }
                licenseInfo {
                  name
                  spdxId
                }
                owner {
                  login
                  avatarUrl
                  url
                }
                primaryLanguage {
                  name
                  color
                }
                repositoryTopics(first: 30) {
                  nodes {
                    topic {
                      name
                    }
                  }
                }
                languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
                  edges {
                    size
                    node {
                      name
                      color
                    }
                  }
                }
              }
            }
          }
        }
      }
      `,
      { login: username }
    );

    return (data?.user?.pinnedItems?.nodes || []).map((repo) => normalizeRepository(repo));
  }

  async getContributionCalendar(username) {
    const data = await this.graphql(
      `
      query ContributionCalendar($login: String!) {
        user(login: $login) {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  color
                  contributionCount
                  date
                  weekday
                }
              }
            }
          }
        }
      }
      `,
      { login: username }
    );

    return data?.user?.contributionsCollection?.contributionCalendar || null;
  }

  async getRepositoryLanguages(fullName) {
    return this.safeRequest(
      {
        method: 'GET',
        url: `/repos/${fullName}/languages`
      },
      {},
      `languages for ${fullName}`
    );
  }

  async getRepositoryTopics(repo) {
    if (Array.isArray(repo.topics) && repo.topics.length > 0) {
      return repo.topics;
    }

    const data = await this.safeRequest(
      {
        method: 'GET',
        url: `/repos/${repo.full_name}/topics`
      },
      { names: [] },
      `topics for ${repo.full_name}`
    );

    return data.names || [];
  }

  async getCommitCount(repo) {
    try {
      const response = await this.request({
        method: 'GET',
        url: `/repos/${repo.full_name}/commits`,
        params: {
          sha: repo.default_branch,
          per_page: 1
        }
      });

      return parseLastPageFromLinkHeader(response.headers.link) || response.data.length;
    } catch (error) {
      log.warn(`commit count for ${repo.full_name}: ${error.message}`);
      return 0;
    }
  }

  async getContributorCount(repo) {
    return this.getEndpointCount(
      `/repos/${repo.full_name}/contributors`,
      { anon: true },
      `contributors for ${repo.full_name}`
    );
  }

  async getPullRequestCount(repo) {
    return this.getEndpointCount(
      `/repos/${repo.full_name}/pulls`,
      { state: 'all' },
      `pull requests for ${repo.full_name}`
    );
  }

  async getEndpointCount(url, params, label) {
    try {
      const response = await this.request({
        method: 'GET',
        url,
        params: {
          ...params,
          per_page: 1
        }
      });

      return parseLastPageFromLinkHeader(response.headers.link) || response.data.length;
    } catch (error) {
      log.warn(`${label}: ${error.message}`);
      return 0;
    }
  }

  async getRepositoryRoot(repo) {
    const data = await this.safeRequest(
      {
        method: 'GET',
        url: `/repos/${repo.full_name}/contents`,
        params: {
          ref: repo.default_branch
        }
      },
      [],
      `root contents for ${repo.full_name}`
    );

    return Array.isArray(data) ? data : [];
  }

  async getRepositoryFile(repo, filePath) {
    const data = await this.safeRequest(
      {
        method: 'GET',
        url: `/repos/${repo.full_name}/contents/${encodeURIComponent(filePath)}`,
        params: {
          ref: repo.default_branch
        }
      },
      null,
      `${filePath} in ${repo.full_name}`
    );

    if (!data?.content || data.encoding !== 'base64') {
      return '';
    }

    const decoded = decodeBase64(data.content);
    return decoded.slice(0, 150000);
  }

  async getRepositoryReadme(repo) {
    const data = await this.safeRequest(
      {
        method: 'GET',
        url: `/repos/${repo.full_name}/readme`,
        params: {
          ref: repo.default_branch
        }
      },
      null,
      `README for ${repo.full_name}`
    );

    if (!data?.content || data.encoding !== 'base64') {
      return '';
    }

    return decodeBase64(data.content).slice(0, 80000);
  }

  async getRepositoryAnalysisFiles(repo) {
    const root = await this.getRepositoryRoot(repo);
    const rootNames = new Set(root.map((entry) => entry.name));
    const rootEntries = root.map((entry) => ({
      name: entry.name,
      path: entry.path,
      type: entry.type
    }));
    // Only small root-level manifest/config files are downloaded. That keeps API
    // usage predictable while still giving useful framework and dependency signals.
    const existingFiles = ANALYSIS_FILES.filter((file) => rootNames.has(file));
    const filePairs = await mapLimit(existingFiles, 3, async (file) => [
      file,
      await this.getRepositoryFile(repo, file)
    ]);

    return {
      rootEntries,
      files: Object.fromEntries(filePairs)
    };
  }

  async enrichRepository(repo) {
    const normalized = normalizeRepository(repo);
    const [languages, topics, commitCount, contributorCount, pullRequestCount, analysis, readme] = await Promise.all([
      this.getRepositoryLanguages(normalized.full_name),
      this.getRepositoryTopics(normalized),
      this.getCommitCount(normalized),
      this.getContributorCount(normalized),
      this.getPullRequestCount(normalized),
      this.getRepositoryAnalysisFiles(normalized),
      this.getRepositoryReadme(normalized)
    ]);

    return normalizeRepository({
      ...normalized,
      languages,
      topics,
      commitCount,
      contributorCount,
      pullRequestCount,
      issueCount: normalized.open_issues_count,
      readme,
      deploymentLinks: detectDeploymentLinks(normalized, readme),
      estimatedLinesOfCode: estimateLinesOfCode(languages),
      analysis
    });
  }

  async enrichRepositories(repositories) {
    const activeRepos = repositories.filter((repo) => !repo.archived);
    return mapLimit(activeRepos, 4, async (repo, index) => {
      log.info(`analyzing ${repo.full_name || repo.nameWithOwner} (${index + 1}/${activeRepos.length})`);
      return this.enrichRepository(repo);
    });
  }
}

export function normalizeRepository(repo) {
  const fullName = repo.full_name || repo.nameWithOwner || `${repo.owner?.login}/${repo.name}`;
  const ownerLogin = repo.owner?.login || fullName.split('/')[0];
  const topics =
    repo.topics ||
    repo.repositoryTopics?.nodes?.map((node) => node.topic.name).filter(Boolean) ||
    [];
  const languageEntries =
    repo.languages?.edges?.map((edge) => [edge.node.name, edge.size]) ||
    Object.entries(repo.languages || {});
  const languageMap = Object.fromEntries(languageEntries);
  const primaryLanguage =
    repo.language ||
    repo.primaryLanguage?.name ||
    Object.keys(languageMap).sort((a, b) => languageMap[b] - languageMap[a])[0] ||
    null;

  return {
    id: repo.id || fullName,
    name: repo.name,
    full_name: fullName,
    owner: {
      login: ownerLogin,
      avatar_url: repo.owner?.avatar_url || repo.owner?.avatarUrl || '',
      html_url: repo.owner?.html_url || repo.owner?.url || `https://github.com/${ownerLogin}`
    },
    html_url: repo.html_url || repo.url || `https://github.com/${fullName}`,
    description: repo.description || '',
    homepage: repo.homepage || repo.homepageUrl || '',
    language: primaryLanguage,
    languages: languageMap,
    stargazers_count: repo.stargazers_count ?? repo.stargazerCount ?? 0,
    forks_count: repo.forks_count ?? repo.forkCount ?? 0,
    watchers_count: repo.watchers_count ?? repo.watchers ?? 0,
    open_issues_count: repo.open_issues_count ?? repo.openIssues?.totalCount ?? 0,
    topics,
    license: normalizeLicense(repo.license || repo.licenseInfo),
    created_at: repo.created_at || repo.createdAt || '',
    updated_at: repo.updated_at || repo.updatedAt || '',
    pushed_at: repo.pushed_at || repo.pushedAt || '',
    default_branch: repo.default_branch || repo.defaultBranchRef?.name || 'main',
    size: repo.size || 0,
    private: Boolean(repo.private),
    visibility: repo.visibility || (repo.private ? 'private' : 'public'),
    archived: Boolean(repo.archived ?? repo.isArchived),
    fork: Boolean(repo.fork ?? repo.isFork),
    permissions: repo.permissions || {},
    sourceTags: [...new Set(repo.sourceTags || [])],
    hasPushPermission: Boolean(repo.hasPushPermission || repo.permissions?.push || repo.permissions?.maintain),
    hasAdminPermission: Boolean(repo.hasAdminPermission || repo.permissions?.admin),
    hasMergedPullRequest: Boolean(repo.hasMergedPullRequest || repo.sourceTags?.includes('merged-pr')),
    hasContribution: Boolean(repo.hasContribution || repo.sourceTags?.includes('contributed')),
    commitCount: repo.commitCount || 0,
    contributorCount: repo.contributorCount || 0,
    pullRequestCount: repo.pullRequestCount || 0,
    issueCount: repo.issueCount ?? repo.open_issues_count ?? 0,
    estimatedLinesOfCode: repo.estimatedLinesOfCode || 0,
    deploymentLinks: repo.deploymentLinks || [],
    readme: repo.readme || '',
    analysis: repo.analysis || { rootEntries: [], files: {} },
    detectedTech: repo.detectedTech || []
  };
}

function withSourceTags(repositories, sourceTags) {
  if (!Array.isArray(repositories)) {
    return [];
  }

  return repositories.map((repo) => addSourceTags(repo, sourceTags));
}

function addSourceTags(repo, sourceTags) {
  return {
    ...repo,
    sourceTags: [...new Set([...(repo.sourceTags || []), ...sourceTags])],
    hasMergedPullRequest: Boolean(repo.hasMergedPullRequest || sourceTags.includes('merged-pr'))
  };
}

function mergeRepositories(repositories) {
  const byName = new Map();

  for (const repo of repositories) {
    const normalized = normalizeRepository(repo);
    const key = normalized.full_name.toLowerCase();
    const current = byName.get(key);

    byName.set(key, current ? mergeRepository(current, normalized) : normalized);
  }

  return [...byName.values()];
}

function mergeRepository(current, incoming) {
  const permissions = {
    admin: Boolean(current.permissions.admin || incoming.permissions.admin),
    maintain: Boolean(current.permissions.maintain || incoming.permissions.maintain),
    push: Boolean(current.permissions.push || incoming.permissions.push),
    triage: Boolean(current.permissions.triage || incoming.permissions.triage),
    pull: Boolean(current.permissions.pull || incoming.permissions.pull)
  };

  return normalizeRepository({
    ...current,
    ...incoming,
    description: incoming.description || current.description,
    homepage: incoming.homepage || current.homepage,
    language: incoming.language || current.language,
    languages: {
      ...(current.languages || {}),
      ...(incoming.languages || {})
    },
    topics: [...new Set([...(current.topics || []), ...(incoming.topics || [])])],
    permissions,
    private: current.private || incoming.private,
    visibility: current.private || incoming.private ? 'private' : incoming.visibility || current.visibility,
    sourceTags: [...new Set([...(current.sourceTags || []), ...(incoming.sourceTags || [])])],
    hasPushPermission: current.hasPushPermission || incoming.hasPushPermission || permissions.push || permissions.maintain,
    hasAdminPermission: current.hasAdminPermission || incoming.hasAdminPermission || permissions.admin,
    hasMergedPullRequest: current.hasMergedPullRequest || incoming.hasMergedPullRequest,
    hasContribution: current.hasContribution || incoming.hasContribution
  });
}

function isOwner(repo, username) {
  return repo.owner?.login?.toLowerCase() === username.toLowerCase();
}

function isOrganizationRepository(repo, username, authLogin) {
  if (!repo.owner?.login) {
    return false;
  }

  if (repo.owner.type === 'Organization') {
    return true;
  }

  const owner = repo.owner.login.toLowerCase();
  return owner !== username.toLowerCase() && owner !== authLogin.toLowerCase();
}

function buildCacheKey(config) {
  const params = new URLSearchParams(config.params || {});
  return `${config.method || 'GET'} ${config.url}?${params.toString()}`;
}

function pickCacheHeaders(headers = {}) {
  return {
    link: headers.link || '',
    'x-ratelimit-remaining': headers['x-ratelimit-remaining'] || '',
    'x-ratelimit-reset': headers['x-ratelimit-reset'] || ''
  };
}

function detectDeploymentLinks(repo, readme) {
  const links = new Set();

  if (repo.homepage) {
    links.add(repo.homepage);
  }

  for (const url of extractUrls(readme)) {
    if (isDeploymentUrl(url)) {
      links.add(url);
    }
  }

  return [...links].slice(0, 4);
}

function isDeploymentUrl(url) {
  return [
    'vercel.app',
    'netlify.app',
    'pages.dev',
    'github.io',
    'render.com',
    'railway.app',
    'fly.dev',
    'firebaseapp.com',
    'web.app'
  ].some((host) => url.includes(host));
}

function estimateLinesOfCode(languages = {}) {
  const totalBytes = Object.values(languages).reduce((sum, bytes) => sum + Number(bytes || 0), 0);
  return Math.round(totalBytes / 45);
}

function normalizeLicense(license) {
  if (!license) {
    return null;
  }

  return {
    key: license.key || license.spdxId || '',
    name: license.name || license.spdxId || ''
  };
}
