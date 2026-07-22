import path from 'node:path';
import {
  compact,
  escapeHtml,
  formatDate,
  formatNumber,
  readTextFile,
  shieldUrl,
  sortByPushedDesc,
  toUrl
} from './utils.js';
import { projectEmoji, TECH_STACK, visibleProjectTech } from './stats.js';

export async function loadTemplate(rootDir) {
  return readTextFile(path.join(rootDir, 'README.template.md'));
}

export function buildReadme({
  template,
  username,
  user,
  organizations,
  latestRepos,
  languageStats,
  detectedTech,
  repositoryTotals,
  projectSectionLimit
}) {
  const replacements = {
    PROFILE_HEADER: buildProfileHeader({ username, user, organizations, repositoryTotals }),
    PORTFOLIO_OVERVIEW: buildPortfolioOverview(username),
    TECH_STACK: buildTechStack(detectedTech),
    LATEST_PROJECTS: buildProjectSection('Latest Projects', latestRepos, {
      emptyText: 'No accessible repositories were found.',
      limit: projectSectionLimit,
      showOwner: true
    }),
    LANGUAGE_ANALYSIS: buildLanguageAnalysis(languageStats),
    GITHUB_STATS: buildGitHubStats(username),
    ORGANIZATIONS: buildOrganizations(organizations),
    FOOTER: buildFooter(username)
  };

  return `${Object.entries(replacements).reduce(
    (content, [key, value]) => content.replaceAll(`{{${key}}}`, value),
    template
  ).trim()}\n`;
}

function buildPortfolioOverview(username) {
  return `## Portfolio Overview

<div align="center">
  <img src="./assets/portfolio-overview.svg" alt="${escapeHtml(username)} automated portfolio overview" />
</div>`;
}

function buildProfileHeader({ username, user, organizations, repositoryTotals }) {
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

  return `<div align="center">
  <a href="https://github.com/${encodeURIComponent(username)}">
    <img src="${user.avatar_url}" alt="${login}" width="130" height="130" />
  </a>
  <h1>${displayName}</h1>
  <p><strong>@${login}</strong></p>
  <p>${bio}</p>
  <p>
${badges}
  </p>
${profileLinksBlock}
</div>`;
}

function buildTechStack(detectedTech) {
  const techs = detectedTech.filter((tech) => TECH_STACK.some((known) => known.id === tech.id));

  if (techs.length === 0) {
    return `## Tech Stack

<div align="center">
  <p>No matching technologies were detected from public repository languages, topics, or dependency files.</p>
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

function buildProjectSection(title, repositories, { emptyText, limit, showOwner = false }) {
  const activeRepos = sortByPushedDesc(repositories.filter((repo) => !repo.archived)).slice(0, limit);

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

  return `### ${projectEmoji(repo)} [${escapeHtml(title)}](${repo.html_url})

${description}

<p>
${metadataBadges}
</p>

<p>
${techBadges}
</p>

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

function buildLanguageAnalysis(languageStats) {
  const languageBadges = languageStats.topLanguages
    .map((language) =>
      imageBadge(language.name, `${language.percent}%`, language.color.replace('#', ''), languageLogo(language.name))
    )
    .join('\n');

  return `## Language Analysis

<div align="center">
  <img src="./assets/language-chart.svg" alt="Repository language usage chart" />
  <p>
${languageBadges || imageBadge('Languages', 'no public data', '6e7681', 'github')}
  </p>
</div>`;
}

function buildGitHubStats(username) {
  const encoded = encodeURIComponent(username);

  return `## GitHub Stats

<div align="center">
  <picture>
    <source srcset="https://github-readme-stats.vercel.app/api?username=${encoded}&show_icons=true&include_all_commits=true&hide_border=true&theme=github_dark" media="(prefers-color-scheme: dark)" />
    <img height="170" src="https://github-readme-stats.vercel.app/api?username=${encoded}&show_icons=true&include_all_commits=true&hide_border=true&theme=default" alt="${encoded} GitHub stats" />
  </picture>
  <picture>
    <source srcset="https://github-readme-stats.vercel.app/api/top-langs/?username=${encoded}&layout=compact&hide_border=true&theme=github_dark" media="(prefers-color-scheme: dark)" />
    <img height="170" src="https://github-readme-stats.vercel.app/api/top-langs/?username=${encoded}&layout=compact&hide_border=true&theme=default" alt="${encoded} top languages" />
  </picture>
  <br />
  <picture>
    <source srcset="https://streak-stats.demolab.com?user=${encoded}&theme=github-dark-blue&hide_border=true" media="(prefers-color-scheme: dark)" />
    <img src="https://streak-stats.demolab.com?user=${encoded}&theme=default&hide_border=true" alt="${encoded} GitHub streak" />
  </picture>
  <br />
  <picture>
    <source srcset="https://github-readme-activity-graph.vercel.app/graph?username=${encoded}&theme=github-dark&hide_border=true" media="(prefers-color-scheme: dark)" />
    <img src="https://github-readme-activity-graph.vercel.app/graph?username=${encoded}&theme=minimal&hide_border=true" alt="${encoded} activity graph" />
  </picture>
  <br />
  <img src="./assets/contribution-calendar.svg" alt="${encoded} contribution calendar" />
  <br />
  <img src="./assets/github-contribution-grid-snake.svg" alt="${encoded} contribution snake" />
</div>`;
}

function buildOrganizations(organizations) {
  if (organizations.length === 0) {
    return `## Organizations

<div align="center">
  <p>No public organizations were found.</p>
</div>`;
  }

  const orgIcons = organizations
    .map((org) => `  <a href="${org.html_url}"><img src="${org.avatar_url}" alt="${escapeHtml(org.login)}" title="${escapeHtml(org.login)}" width="50" height="50" /></a>`)
    .join('\n');

  return `## Organizations

<div align="center">
  <p>
${orgIcons}
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
    vue: 'vuedotjs',
    csharp: 'dotnet',
    'c#': 'dotnet',
    shell: 'gnubash',
    dockerfile: 'docker',
    markdown: 'markdown'
  };

  return logos[normalized] || '';
}
