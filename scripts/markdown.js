import path from 'node:path';
import axios from 'axios';
import {
  compact,
  escapeHtml,
  formatDate,
  formatNumber,
  log,
  readTextFile,
  shieldUrl,
  sortByPushedDesc,
  toUrl
} from './utils.js';
import { projectEmoji, TECH_STACK, visibleProjectTech } from './stats.js';

const GITHUB_STATS_PRIMARY_BASE_URL = 'https://github-readme-stats.vercel.app/api';
const GITHUB_STATS_MIRROR_BASE_URL = 'https://github-readme-stats-git-masterrstaa-rickstaa.vercel.app/api';

export async function loadTemplate(rootDir) {
  return readTextFile(path.join(rootDir, 'README.template.md'));
}

export function buildReadme({
  template,
  username,
  user,
  organizations,
  latestRepos,
  topProjects = [],
  organizationProjects = [],
  languageStats,
  detectedTech,
  repositoryTotals,
  projectSectionLimit,
  githubStatsImageUrls = buildGitHubStatsImageUrls(username)
}) {
  const replacements = {
    HERO: buildHero({ username, user, organizations, repositoryTotals }),
    ABOUT: buildAbout({ username, user }),
    TECH_STACK: buildTechStack(detectedTech),
    GITHUB_STATISTICS: buildGitHubStatistics(username, githubStatsImageUrls),
    CONTRIBUTION_GRAPH: buildContributionGraph(username),
    LANGUAGE_DISTRIBUTION: buildLanguageDistribution(languageStats),
    TOP_PROJECTS: buildTopProjects(topProjects, projectSectionLimit),
    ORGANIZATION_PROJECTS: buildProjectSection('Organization Projects', organizationProjects, {
      emptyText: 'No organization repositories with contribution or push access were found.',
      limit: projectSectionLimit,
      showOwner: true
    }),
    LATEST_UPDATED_PROJECTS: buildProjectSection('Latest Updated Projects', latestRepos, {
      emptyText: 'No accessible repositories were found.',
      limit: projectSectionLimit,
      showOwner: true
    }),
    ACHIEVEMENTS: buildAchievements(repositoryTotals, detectedTech, organizations),
    ACTIVITY_TIMELINE: buildActivityTimeline(),
    CONTRIBUTION_SNAKE: buildContributionSnake(username),
    RANDOM_QUOTE: buildRandomQuote(username),
    CONTACT: buildContact({ username, user }),
    FOOTER: buildFooter(username)
  };

  return `${Object.entries(replacements).reduce(
    (content, [key, value]) => content.replaceAll(`{{${key}}}`, value),
    template
  ).trim()}\n`;
}

/**
 * Resolves GitHub statistics image URLs with the primary service first and the
 * maintained mirror as a fallback when the primary service is unavailable.
 *
 * @param {string} username
 * @returns {Promise<{ stats: string, topLanguages: string, service: string, verified: boolean }>}
 */
export async function resolveGitHubStatsImageUrls(username) {
  const primary = buildGitHubStatsImageUrls(username, GITHUB_STATS_PRIMARY_BASE_URL);

  if (process.env.GITHUB_STATS_IMAGE_SERVICE === 'mirror') {
    log.info('GitHub stats images forced to mirror service by GITHUB_STATS_IMAGE_SERVICE=mirror');
    return {
      ...buildGitHubStatsImageUrls(username, GITHUB_STATS_MIRROR_BASE_URL),
      service: 'mirror',
      verified: false
    };
  }

  const primaryStatus = await verifyGitHubStatsImageUrls(primary);

  if (primaryStatus.ok) {
    log.info(`GitHub stats images verified through primary service (${primaryStatus.statuses.join(', ')})`);
    return {
      ...primary,
      service: 'primary',
      verified: true
    };
  }

  log.warn(`primary GitHub stats service failed verification (${primaryStatus.statuses.join(', ') || 'network error'}); checking mirror`);
  const mirror = buildGitHubStatsImageUrls(username, GITHUB_STATS_MIRROR_BASE_URL);
  const mirrorStatus = await verifyGitHubStatsImageUrls(mirror);

  if (mirrorStatus.ok) {
    log.info(`GitHub stats images verified through mirror service (${mirrorStatus.statuses.join(', ')})`);
    return {
      ...mirror,
      service: 'mirror',
      verified: true
    };
  }

  log.warn(`GitHub stats image verification failed for primary and mirror; keeping primary URLs for GitHub rendering retry`);
  return {
    ...primary,
    service: 'primary',
    verified: false
  };
}

function buildGitHubStatsImageUrls(username, baseUrl = GITHUB_STATS_PRIMARY_BASE_URL) {
  const encoded = encodeURIComponent(username);
  const topLanguagesEndpoint = baseUrl === GITHUB_STATS_MIRROR_BASE_URL
    ? `${baseUrl}/top-langs`
    : `${baseUrl}/top-langs/`;

  return {
    stats: `${baseUrl}?username=${encoded}&show_icons=true&theme=github_dark&hide_border=true&cache_seconds=1800`,
    topLanguages: `${topLanguagesEndpoint}?username=${encoded}&layout=compact&theme=github_dark&hide_border=true&cache_seconds=1800`
  };
}

async function verifyGitHubStatsImageUrls(urls) {
  const statuses = await Promise.all([
    getHttpStatus(urls.stats),
    getHttpStatus(urls.topLanguages)
  ]);

  return {
    ok: statuses.every((status) => status === 200),
    statuses
  };
}

async function getHttpStatus(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'text',
      timeout: 10000,
      validateStatus: () => true,
      headers: {
        Accept: 'image/svg+xml,text/plain,*/*'
      }
    });

    return response.status;
  } catch (error) {
    log.warn(`could not verify ${url}: ${error.message}`);
    return 0;
  }
}

/**
 * Builds the first visible profile block, including a generated typing banner.
 *
 * @param {{ username: string, user: Record<string, any>, organizations: Array<Record<string, any>>, repositoryTotals: Record<string, number> }} input
 * @returns {string}
 */
function buildHero({ username, user, organizations, repositoryTotals }) {
  const displayName = escapeHtml(user.name || username);
  const login = escapeHtml(user.login || username);
  const bio = escapeHtml(user.bio || `GitHub profile for @${username}`);
  const website = toUrl(user.blog);
  const twitterUrl = user.twitter_username ? `https://twitter.com/${user.twitter_username}` : '';
  const badges = compact([
    imageBadge('Public Repos', formatNumber(user.public_repos || 0), '238636', 'github'),
    imageBadge('Followers', formatNumber(user.followers || 0), '2ea44f', 'github'),
    imageBadge('Following', formatNumber(user.following || 0), '0969da', 'github'),
    imageBadge('Stars', formatNumber(repositoryTotals.stars), 'd29922', 'github'),
    imageBadge('Forks', formatNumber(repositoryTotals.forks), '8250df', 'github'),
    organizations.length ? imageBadge('Organizations', formatNumber(organizations.length), 'db6d28', 'github') : ''
  ]).join('\n');
  const profileLinks = compact([
    user.location ? imageBadge('Location', user.location, '30363d', 'googlemaps') : '',
    user.company ? imageBadge('Company', user.company.replace(/^@/, ''), '30363d', 'github') : '',
    website ? linkBadge('Website', website, '0A66C2', 'googlechrome', website) : '',
    twitterUrl ? linkBadge('Twitter', `@${user.twitter_username}`, '1DA1F2', 'x', twitterUrl) : ''
  ]).join('\n');
  const profileLinksBlock = profileLinks
    ? `  <p>
${profileLinks}
  </p>`
    : '';
  const typingText = encodeURIComponent([
    'GitHub Profile generated from live API data',
    'Full-stack projects, automation, and engineering metrics',
    'Private, organization, collaborator, and merged-PR work analyzed'
  ].join(';'));

  return `<div align="center">
  <a href="https://github.com/${encodeURIComponent(username)}">
    <img src="${user.avatar_url}" alt="${login}" width="130" height="130" />
  </a>
  <h1>${displayName}</h1>
  <p><strong>@${login}</strong></p>
  <p>
    <img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=22&duration=2600&pause=850&color=58A6FF&center=true&vCenter=true&width=760&lines=${typingText}" alt="${login} typing animation" />
  </p>
  <p>${bio}</p>
  <p>
${badges}
  </p>
${profileLinksBlock}
</div>`;
}

function buildAbout({ username, user }) {
  const lines = compact([
    user.bio ? escapeHtml(user.bio) : `This profile is generated automatically from live GitHub data for <strong>@${escapeHtml(username)}</strong>.`,
    user.company ? `Building and contributing from <strong>${escapeHtml(user.company)}</strong>.` : '',
    user.location ? `Based in <strong>${escapeHtml(user.location)}</strong>.` : '',
    'Repository languages, topics, dependency manifests, permissions, activity, commits, pull requests, and organizations are analyzed on every run.'
  ]);

  return `## About

<div align="center">
  <img src="./assets/portfolio-overview.svg" alt="${escapeHtml(username)} automated portfolio overview" />
</div>

${lines.map((line) => `<p align="center">${line}</p>`).join('\n')}`;
}

function buildTechStack(detectedTech) {
  const techs = detectedTech.filter((tech) => TECH_STACK.some((known) => known.id === tech.id));

  if (techs.length === 0) {
    return `## Tech Stack

<div align="center">
  <p>No matching technologies were detected from accessible repository languages, topics, or dependency files.</p>
</div>`;
  }

  const icons = techs
    .map((tech) => {
      if (!tech.icon) {
        return `  <a href="${tech.site}" target="_blank" rel="noopener noreferrer"><img src="${shieldUrl({
          label: '',
          message: tech.label,
          color: tech.color,
          style: 'for-the-badge'
        })}" alt="${escapeHtml(tech.label)}" /></a>`;
      }

      return `  <a href="${tech.site}" target="_blank" rel="noopener noreferrer"><img src="${tech.icon}" alt="${escapeHtml(tech.label)}" title="${escapeHtml(tech.label)}" width="44" height="44" /></a>`;
    })
    .join('\n');

  return `## Tech Stack

<div align="center">
  <p>
${icons}
  </p>
</div>`;
}

function buildGitHubStatistics(username, imageUrls) {
  const encoded = encodeURIComponent(username);

  return `## GitHub Statistics

<div align="center">
  <img src="./assets/github-summary.svg" alt="${encoded} GitHub engineering summary" />
  <br />
  <img height="170" src="${imageUrls.stats}" alt="${encoded} GitHub Stats" />
  <img height="170" src="${imageUrls.topLanguages}" alt="${encoded} Top Languages" />
  <br />
  <picture>
    <source srcset="https://streak-stats.demolab.com?user=${encoded}&theme=github-dark-blue&hide_border=true" media="(prefers-color-scheme: dark)" />
    <img src="https://streak-stats.demolab.com?user=${encoded}&theme=default&hide_border=true" alt="${encoded} GitHub streak" />
  </picture>
</div>`;
}

function buildContributionGraph(username) {
  const encoded = encodeURIComponent(username);

  return `## Contribution Graph

<div align="center">
  <picture>
    <source srcset="https://github-readme-activity-graph.vercel.app/graph?username=${encoded}&theme=github-dark&hide_border=true" media="(prefers-color-scheme: dark)" />
    <img src="https://github-readme-activity-graph.vercel.app/graph?username=${encoded}&theme=minimal&hide_border=true" alt="${encoded} activity graph" />
  </picture>
  <br />
  <img src="./assets/contribution-calendar.svg" alt="${encoded} contribution calendar" />
</div>`;
}

function buildLanguageDistribution(languageStats) {
  const languageBadges = languageStats.topLanguages
    .map((language) =>
      imageBadge(language.name, `${language.percent}%`, language.color.replace('#', ''), languageLogo(language.name))
    )
    .join('\n');

  return `## Language Distribution

<div align="center">
  <img src="./assets/language-chart.svg" alt="Repository language distribution chart" />
  <p>
${languageBadges || imageBadge('Languages', 'waiting for data', '6e7681', 'github')}
  </p>
</div>`;
}

function buildTopProjects(repositories, limit) {
  const cards = buildProjectSection('Top Projects', repositories, {
    emptyText: 'Top projects appear after repository discovery finishes.',
    limit,
    showOwner: true,
    preserveOrder: true
  });

  return `${cards}

<div align="center">
  <img src="./assets/top-projects.svg" alt="Weighted top projects overview" />
</div>`;
}

function buildProjectSection(title, repositories, { emptyText, limit, showOwner = false, preserveOrder = false }) {
  const sourceRepos = repositories.filter((repo) => !repo.archived);
  const activeRepos = (preserveOrder ? sourceRepos : sortByPushedDesc(sourceRepos)).slice(0, limit);

  if (activeRepos.length === 0) {
    return `## ${title}

<div align="center">
  <p>${escapeHtml(emptyText)}</p>
</div>`;
  }

  return `## ${title}

${activeRepos.map((repo) => buildProjectCard(repo, { showOwner })).join('\n\n')}`;
}

function buildProjectCard(repo, { showOwner = false } = {}) {
  const title = showOwner ? repo.full_name : repo.name;
  const description = escapeHtml(repo.description || 'No description provided.');
  const techBadges = buildTechBadges(repo);
  const metadataBadges = buildRepositoryMetadataBadges(repo);
  const deploymentLinks = (repo.deploymentLinks || [])
    .filter((url) => url !== repo.homepage)
    .slice(0, 2);
  const links = compact([
    linkBadge('GitHub', 'Repository', '181717', 'github', repo.html_url),
    repo.homepage ? linkBadge('Demo', 'Live', '0E9F6E', 'googlechrome', toUrl(repo.homepage)) : '',
    ...deploymentLinks.map((url, index) => linkBadge('Deploy', `Link ${index + 1}`, '0A66C2', 'rocket', toUrl(url)))
  ]).join('\n');
  const techBlock = techBadges
    ? `<p>
${techBadges}
</p>`
    : '';

  return `### ${projectEmoji(repo)} [${escapeHtml(title)}](${repo.html_url})

${description}

<p>
${metadataBadges}
</p>

${techBlock}
<p>
${links}
</p>`;
}

function buildRepositoryMetadataBadges(repo) {
  return compact([
    repo.private ? imageBadge('Visibility', 'Private', '6f42c1', 'github') : imageBadge('Visibility', 'Public', '238636', 'github'),
    repo.language ? imageBadge('Language', repo.language, languageBadgeColor(repo.language), languageLogo(repo.language)) : '',
    imageBadge('Stars', formatNumber(repo.stargazers_count), 'd29922', 'github'),
    imageBadge('Forks', formatNumber(repo.forks_count), '8250df', 'git'),
    repo.watchers_count ? imageBadge('Watchers', formatNumber(repo.watchers_count), '1f6feb', 'github') : '',
    imageBadge('Commits', formatNumber(repo.commitCount), '238636', 'git'),
    repo.pullRequestCount ? imageBadge('PRs', formatNumber(repo.pullRequestCount), '8250df', 'github') : '',
    repo.contributorCount ? imageBadge('Contributors', formatNumber(repo.contributorCount), '2ea44f', 'github') : '',
    repo.estimatedLinesOfCode ? imageBadge('Est. LOC', formatNumber(repo.estimatedLinesOfCode), '0A66C2', 'code') : '',
    imageBadge('Open Issues', formatNumber(repo.open_issues_count), 'da3633', 'github'),
    repo.default_branch ? imageBadge('Default Branch', repo.default_branch, '0969da', 'git') : '',
    repo.license?.name ? imageBadge('License', repo.license.key || repo.license.name, '6e7681', 'opensourceinitiative') : '',
    repo.fork ? imageBadge('Fork', 'yes', '6e7681', 'github') : '',
    repo.sourceTags?.includes('pinned') ? imageBadge('Source', 'Pinned', 'd29922', 'github') : '',
    repo.sourceTags?.includes('personal') ? imageBadge('Source', 'Personal', '238636', 'github') : '',
    repo.sourceTags?.includes('organization') ? imageBadge('Source', 'Organization', '0969da', 'github') : '',
    repo.hasAdminPermission ? imageBadge('Permission', 'Admin', 'cf222e', 'github') : '',
    repo.hasPushPermission && !repo.hasAdminPermission ? imageBadge('Permission', 'Push', '0969da', 'github') : '',
    repo.hasMergedPullRequest ? imageBadge('Merged PR', 'Yes', '8250df', 'github') : '',
    repo.hasContribution ? imageBadge('Contribution', 'Yes', '238636', 'github') : '',
    imageBadge('Updated', formatDate(repo.pushed_at || repo.updated_at), '30363d', 'github')
  ]).join('\n');
}

function buildTechBadges(repo) {
  const techs = visibleProjectTech(repo);

  if (techs.length === 0 && repo.topics?.length > 0) {
    return repo.topics
      .slice(0, 6)
      .map((topic) => imageBadge('Topic', topic, '30363d', 'github'))
      .join('\n');
  }

  if (techs.length === 0 && repo.language) {
    return imageBadge('Tech', repo.language, languageBadgeColor(repo.language), languageLogo(repo.language));
  }

  return techs
    .map((tech) => imageBadge('Tech', tech.label, tech.color, tech.logo))
    .join('\n');
}

function buildAchievements(repositoryTotals, detectedTech, organizations) {
  const badges = compact([
    imageBadge('Repositories', formatNumber(repositoryTotals.repositories), '238636', 'github'),
    imageBadge('Private Repos', formatNumber(repositoryTotals.privateRepos), '6f42c1', 'github'),
    imageBadge('Organization Repos', formatNumber(repositoryTotals.organizationRepos), '0969da', 'github'),
    imageBadge('Total Commits', formatNumber(repositoryTotals.commits), '2ea44f', 'git'),
    imageBadge('Merged PRs', formatNumber(repositoryTotals.mergedPullRequests), '8250df', 'github'),
    imageBadge('Reviews', formatNumber(repositoryTotals.reviews), 'cf222e', 'github'),
    imageBadge('Stars', formatNumber(repositoryTotals.stars), 'd29922', 'github'),
    imageBadge('Forks', formatNumber(repositoryTotals.forks), '8250df', 'git'),
    imageBadge('Est. LOC', formatNumber(repositoryTotals.estimatedLinesOfCode), '0A66C2', 'code'),
    imageBadge('Detected Tech', formatNumber(detectedTech.length), '58a6ff', 'github'),
    organizations.length ? imageBadge('Organizations', formatNumber(organizations.length), 'db6d28', 'github') : ''
  ]).join('\n');

  return `## Achievements

<div align="center">
  <p>
${badges}
  </p>
</div>`;
}

function buildActivityTimeline() {
  return `## Activity Timeline

<div align="center">
  <img src="./assets/activity-timeline.svg" alt="Latest repository activity timeline" />
</div>`;
}

function buildContributionSnake(username) {
  return `## Contribution Snake

<div align="center">
  <img src="./assets/github-contribution-grid-snake.svg" alt="${escapeHtml(username)} contribution snake" />
</div>`;
}

function buildRandomQuote(username) {
  const quotes = [
    'Build systems that can explain themselves.',
    'Great automation turns routine maintenance into a reliable signal.',
    'Readable code is operational leverage.',
    'Measure the work, improve the workflow, ship the result.',
    'The strongest portfolio is current because it updates itself.'
  ];
  const index = [...username].reduce((sum, char) => sum + char.charCodeAt(0), 0) % quotes.length;

  return `## Random Quote

<div align="center">
  <blockquote><strong>${escapeHtml(quotes[index])}</strong></blockquote>
</div>`;
}

function buildContact({ username, user }) {
  const website = toUrl(user.blog);
  const twitterUrl = user.twitter_username ? `https://twitter.com/${user.twitter_username}` : '';
  const links = compact([
    linkBadge('GitHub', `@${username}`, '181717', 'github', `https://github.com/${encodeURIComponent(username)}`),
    website ? linkBadge('Website', 'Portfolio', '0A66C2', 'googlechrome', website) : '',
    twitterUrl ? linkBadge('Twitter', `@${user.twitter_username}`, '1DA1F2', 'x', twitterUrl) : ''
  ]).join('\n');

  return `## Contact

<div align="center">
  <p>
${links}
  </p>
</div>`;
}

function buildFooter(username) {
  return `<div align="center">
  <sub>README generated automatically from the GitHub API for <a href="https://github.com/${encodeURIComponent(username)}">@${escapeHtml(username)}</a>.</sub>
</div>`;
}

function imageBadge(label, message, color, logo = '') {
  return `    <img src="${shieldUrl({ label, message: String(message), color, logo })}" alt="${escapeHtml(`${label}: ${message}`)}" />`;
}

function linkBadge(label, message, color, logo, href) {
  return `    <a href="${href}"><img src="${shieldUrl({ label, message: String(message), color, logo })}" alt="${escapeHtml(`${label}: ${message}`)}" /></a>`;
}

function languageBadgeColor(language) {
  const tech = TECH_STACK.find((item) => item.label.toLowerCase() === language.toLowerCase());
  return tech?.color || '6e7681';
}

function languageLogo(language) {
  const normalized = language.toLowerCase();
  const logos = {
    html: 'html5',
    css: 'css3',
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    java: 'openjdk',
    php: 'php',
    kotlin: 'kotlin',
    go: 'go',
    rust: 'rust',
    dart: 'dart',
    swift: 'swift',
    vue: 'vuedotjs',
    react: 'react',
    node: 'nodedotjs',
    csharp: 'dotnet',
    'c#': 'dotnet',
    'c++': 'cplusplus',
    shell: 'gnubash',
    dockerfile: 'docker',
    markdown: 'markdown'
  };

  return logos[normalized] || '';
}
