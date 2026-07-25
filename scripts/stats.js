import path from 'node:path';
import { ensureDir, escapeHtml, formatDate, formatNumber, percentage, writeFileIfChanged } from './utils.js';

const LANGUAGE_BUCKETS = [
  'HTML',
  'CSS',
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'PHP',
  'Kotlin',
  'C#',
  'C++',
  'Go',
  'Rust',
  'Swift',
  'Dart',
  'Vue',
  'React',
  'Node',
  'Others'
];

export const TECH_STACK = [
  {
    id: 'html',
    label: 'HTML',
    site: 'https://developer.mozilla.org/en-US/docs/Web/HTML',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg',
    logo: 'html5',
    color: 'E34F26',
    languages: ['html'],
    topics: ['html', 'html5'],
    files: ['index.html']
  },
  {
    id: 'css',
    label: 'CSS',
    site: 'https://developer.mozilla.org/en-US/docs/Web/CSS',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg',
    logo: 'css3',
    color: '1572B6',
    languages: ['css'],
    topics: ['css', 'css3'],
    files: ['style.css', 'styles.css']
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    site: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg',
    logo: 'javascript',
    color: 'F7DF1E',
    languages: ['javascript'],
    topics: ['javascript', 'js']
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    site: 'https://www.typescriptlang.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg',
    logo: 'typescript',
    color: '3178C6',
    languages: ['typescript'],
    topics: ['typescript', 'ts'],
    packageDeps: ['typescript']
  },
  {
    id: 'react',
    label: 'React',
    site: 'https://react.dev/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg',
    logo: 'react',
    color: '61DAFB',
    topics: ['react', 'reactjs'],
    packageDeps: ['react', 'react-dom']
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    site: 'https://nextjs.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg',
    logo: 'nextdotjs',
    color: '000000',
    topics: ['nextjs', 'next-js', 'next'],
    files: ['next.config.js', 'next.config.cjs', 'next.config.mjs'],
    packageDeps: ['next']
  },
  {
    id: 'nuxt',
    label: 'Nuxt',
    site: 'https://nuxt.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nuxtjs/nuxtjs-original.svg',
    logo: 'nuxtdotjs',
    color: '00DC82',
    topics: ['nuxt', 'nuxtjs'],
    files: ['nuxt.config.js', 'nuxt.config.ts'],
    packageDeps: ['nuxt', 'nuxt3']
  },
  {
    id: 'vue',
    label: 'Vue',
    site: 'https://vuejs.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vuejs/vuejs-original.svg',
    logo: 'vuedotjs',
    color: '4FC08D',
    topics: ['vue', 'vuejs', 'vue-js'],
    packageDeps: ['vue']
  },
  {
    id: 'angular',
    label: 'Angular',
    site: 'https://angular.dev/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/angular/angular-original.svg',
    logo: 'angular',
    color: 'DD0031',
    topics: ['angular'],
    files: ['angular.json'],
    packageDeps: ['@angular/core', '@angular/cli']
  },
  {
    id: 'tailwind',
    label: 'Tailwind',
    site: 'https://tailwindcss.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg',
    logo: 'tailwindcss',
    color: '06B6D4',
    topics: ['tailwind', 'tailwindcss'],
    files: ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs'],
    packageDeps: ['tailwindcss', '@tailwindcss/vite']
  },
  {
    id: 'bootstrap',
    label: 'Bootstrap',
    site: 'https://getbootstrap.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bootstrap/bootstrap-original.svg',
    logo: 'bootstrap',
    color: '7952B3',
    topics: ['bootstrap'],
    packageDeps: ['bootstrap']
  },
  {
    id: 'nodejs',
    label: 'Node.js',
    site: 'https://nodejs.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg',
    logo: 'nodedotjs',
    color: '339933',
    topics: ['node', 'nodejs', 'node-js'],
    files: ['package.json'],
    packageDeps: ['express', 'next', 'react', 'vue', 'vite']
  },
  {
    id: 'express',
    label: 'Express',
    site: 'https://expressjs.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/express/express-original.svg',
    logo: 'express',
    color: '000000',
    topics: ['express', 'expressjs'],
    packageDeps: ['express']
  },
  {
    id: 'nestjs',
    label: 'NestJS',
    site: 'https://nestjs.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nestjs/nestjs-original.svg',
    logo: 'nestjs',
    color: 'E0234E',
    topics: ['nestjs', 'nest-js'],
    packageDeps: ['@nestjs/core', '@nestjs/common']
  },
  {
    id: 'python',
    label: 'Python',
    site: 'https://www.python.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
    logo: 'python',
    color: '3776AB',
    languages: ['python'],
    topics: ['python'],
    files: ['requirements.txt', 'pyproject.toml', 'Pipfile']
  },
  {
    id: 'java',
    label: 'Java',
    site: 'https://www.java.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg',
    logo: 'openjdk',
    color: 'ED8B00',
    languages: ['java'],
    topics: ['java'],
    files: ['pom.xml', 'build.gradle']
  },
  {
    id: 'spring',
    label: 'Spring Boot',
    site: 'https://spring.io/projects/spring-boot',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/spring/spring-original.svg',
    logo: 'springboot',
    color: '6DB33F',
    topics: ['spring', 'spring-boot', 'springboot'],
    packageDeps: ['spring-boot-starter', 'org.springframework.boot'],
    contentPatterns: ['spring-boot-starter', 'org.springframework.boot']
  },
  {
    id: 'php',
    label: 'PHP',
    site: 'https://www.php.net/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg',
    logo: 'php',
    color: '777BB4',
    languages: ['php'],
    topics: ['php'],
    files: ['composer.json']
  },
  {
    id: 'laravel',
    label: 'Laravel',
    site: 'https://laravel.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/laravel/laravel-original.svg',
    logo: 'laravel',
    color: 'FF2D20',
    topics: ['laravel'],
    packageDeps: ['laravel/framework']
  },
  {
    id: 'kotlin',
    label: 'Kotlin',
    site: 'https://kotlinlang.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kotlin/kotlin-original.svg',
    logo: 'kotlin',
    color: '7F52FF',
    languages: ['kotlin'],
    topics: ['kotlin'],
    files: ['build.gradle.kts']
  },
  {
    id: 'dotnet',
    label: 'ASP.NET',
    site: 'https://dotnet.microsoft.com/apps/aspnet',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/dot-net/dot-net-original.svg',
    logo: 'dotnet',
    color: '512BD4',
    languages: ['c#', 'f#', 'visual basic .net'],
    topics: ['aspnet', 'asp-net', 'dotnet'],
    files: ['appsettings.json'],
    contentPatterns: ['microsoft.aspnetcore', 'webapplication.createbuilder']
  },
  {
    id: 'mysql',
    label: 'MySQL',
    site: 'https://www.mysql.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg',
    logo: 'mysql',
    color: '4479A1',
    topics: ['mysql', 'mariadb', 'sql'],
    packageDeps: ['mysql', 'mysql2', 'sequelize', 'knex'],
    contentPatterns: ['mysqlclient', 'pymysql', 'pdo_mysql', 'mariadb']
  },
  {
    id: 'mongodb',
    label: 'MongoDB',
    site: 'https://www.mongodb.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg',
    logo: 'mongodb',
    color: '47A248',
    topics: ['mongodb', 'mongo'],
    packageDeps: ['mongodb', 'mongoose'],
    contentPatterns: ['pymongo', 'motor']
  },
  {
    id: 'postgresql',
    label: 'PostgreSQL',
    site: 'https://www.postgresql.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg',
    logo: 'postgresql',
    color: '4169E1',
    topics: ['postgresql', 'postgres', 'pgsql'],
    packageDeps: ['pg', 'postgres', 'psycopg2', 'asyncpg'],
    contentPatterns: ['postgresql', 'postgres://']
  },
  {
    id: 'redis',
    label: 'Redis',
    site: 'https://redis.io/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg',
    logo: 'redis',
    color: 'DC382D',
    topics: ['redis'],
    packageDeps: ['redis', 'ioredis', 'django-redis'],
    contentPatterns: ['redis://']
  },
  {
    id: 'firebase',
    label: 'Firebase',
    site: 'https://firebase.google.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/firebase/firebase-original.svg',
    logo: 'firebase',
    color: 'FFCA28',
    topics: ['firebase', 'firestore'],
    files: ['firebase.json'],
    packageDeps: ['firebase', 'firebase-admin'],
    contentPatterns: ['firebaseapp.com', 'firestore']
  },
  {
    id: 'git',
    label: 'Git',
    site: 'https://git-scm.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg',
    logo: 'git',
    color: 'F05032',
    files: ['.gitignore'],
    globalWhenReposExist: true,
    hideOnProjectCards: true
  },
  {
    id: 'github',
    label: 'GitHub',
    site: 'https://github.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg',
    logo: 'github',
    color: '181717',
    files: ['.github'],
    globalWhenReposExist: true,
    hideOnProjectCards: true
  },
  {
    id: 'github-actions',
    label: 'GitHub Actions',
    site: 'https://github.com/features/actions',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/githubactions/githubactions-original.svg',
    logo: 'githubactions',
    color: '2088FF',
    topics: ['github-actions', 'ci-cd', 'automation'],
    files: ['.github'],
    packageDeps: ['actions/checkout']
  },
  {
    id: 'docker',
    label: 'Docker',
    site: 'https://www.docker.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg',
    logo: 'docker',
    color: '2496ED',
    topics: ['docker', 'docker-compose', 'container'],
    files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml']
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes',
    site: 'https://kubernetes.io/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kubernetes/kubernetes-original.svg',
    logo: 'kubernetes',
    color: '326CE5',
    topics: ['kubernetes', 'k8s', 'helm'],
    contentPatterns: ['apiVersion: apps/v1', 'kind: deployment', 'helm.sh']
  },
  {
    id: 'linux',
    label: 'Linux',
    site: 'https://www.linux.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg',
    logo: 'linux',
    color: 'FCC624',
    languages: ['shell'],
    topics: ['linux', 'bash', 'shell'],
    contentPatterns: ['#!/bin/bash', '#!/usr/bin/env bash', 'ubuntu', 'alpine', 'debian']
  },
  {
    id: 'vscode',
    label: 'VSCode',
    site: 'https://code.visualstudio.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg',
    logo: 'visualstudiocode',
    color: '007ACC',
    topics: ['vscode', 'visual-studio-code'],
    files: ['.vscode']
  },
  {
    id: 'figma',
    label: 'Figma',
    site: 'https://www.figma.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/figma/figma-original.svg',
    logo: 'figma',
    color: 'F24E1E',
    topics: ['figma', 'ui-design', 'ux-design'],
    contentPatterns: ['figma.com']
  },
  {
    id: 'markdown',
    label: 'Markdown',
    site: 'https://www.markdownguide.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/markdown/markdown-original.svg',
    logo: 'markdown',
    color: '000000',
    languages: ['markdown'],
    topics: ['markdown', 'readme'],
    files: ['README.md']
  },
  {
    id: 'opencv',
    label: 'OpenCV',
    site: 'https://opencv.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/opencv/opencv-original.svg',
    logo: 'opencv',
    color: '5C3EE8',
    topics: ['opencv', 'computer-vision'],
    packageDeps: ['opencv-python', 'opencv-contrib-python'],
    contentPatterns: ['import cv2', 'from cv2']
  },
  {
    id: 'tensorflow',
    label: 'TensorFlow',
    site: 'https://www.tensorflow.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tensorflow/tensorflow-original.svg',
    logo: 'tensorflow',
    color: 'FF6F00',
    topics: ['tensorflow', 'machine-learning', 'deep-learning'],
    packageDeps: ['tensorflow', 'tensorflowjs'],
    contentPatterns: ['import tensorflow', 'from tensorflow']
  },
  {
    id: 'pytorch',
    label: 'PyTorch',
    site: 'https://pytorch.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/pytorch/pytorch-original.svg',
    logo: 'pytorch',
    color: 'EE4C2C',
    topics: ['pytorch', 'torch', 'machine-learning', 'deep-learning'],
    packageDeps: ['torch', 'torchvision', 'torchaudio'],
    contentPatterns: ['import torch', 'from torch']
  },
  {
    id: 'yolo',
    label: 'YOLO',
    site: 'https://www.ultralytics.com/yolo',
    // Devicon does not publish a YOLO icon, so markdown rendering uses a linked badge fallback.
    icon: '',
    logo: '',
    color: '111827',
    topics: ['yolo', 'yolov5', 'yolov8', 'yolov9', 'yolov10', 'ultralytics'],
    packageDeps: ['ultralytics', 'yolov5'],
    contentPatterns: ['from ultralytics import yolo', 'yolo(', 'yolov8', 'yolov5']
  },
  {
    id: 'flask',
    label: 'Flask',
    site: 'https://flask.palletsprojects.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/flask/flask-original.svg',
    logo: 'flask',
    color: '000000',
    topics: ['flask'],
    packageDeps: ['flask', 'flask-cors', 'flask-sqlalchemy'],
    contentPatterns: ['from flask import', 'flask(__name__)']
  },
  {
    id: 'fastapi',
    label: 'FastAPI',
    site: 'https://fastapi.tiangolo.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/fastapi/fastapi-original.svg',
    logo: 'fastapi',
    color: '009688',
    topics: ['fastapi'],
    packageDeps: ['fastapi', 'uvicorn'],
    contentPatterns: ['from fastapi import', 'fastapi(']
  },
  {
    id: 'django',
    label: 'Django',
    site: 'https://www.djangoproject.com/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/django/django-plain.svg',
    logo: 'django',
    color: '092E20',
    topics: ['django'],
    packageDeps: ['django', 'djangorestframework'],
    contentPatterns: ['django.contrib', 'manage.py']
  },
  {
    id: 'go',
    label: 'Go',
    site: 'https://go.dev/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg',
    logo: 'go',
    color: '00ADD8',
    languages: ['go'],
    topics: ['go', 'golang'],
    files: ['go.mod']
  },
  {
    id: 'rust',
    label: 'Rust',
    site: 'https://www.rust-lang.org/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg',
    logo: 'rust',
    color: '000000',
    languages: ['rust'],
    topics: ['rust'],
    files: ['Cargo.toml']
  },
  {
    id: 'flutter',
    label: 'Flutter',
    site: 'https://flutter.dev/',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/flutter/flutter-original.svg',
    logo: 'flutter',
    color: '02569B',
    languages: ['dart'],
    topics: ['flutter', 'dart'],
    files: ['pubspec.yaml'],
    packageDeps: ['flutter']
  }
];

const LANGUAGE_COLORS = {
  HTML: '#e34c26',
  CSS: '#563d7c',
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  PHP: '#4F5D95',
  Kotlin: '#A97BFF',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  Dart: '#00B4AB',
  Vue: '#41b883',
  React: '#61DAFB',
  Node: '#339933',
  Others: '#8b949e',
  'C++': '#f34b7d',
  Swift: '#F05138',
  Shell: '#89e051',
  Dockerfile: '#384d54',
  Markdown: '#083fa1'
};

export function analyzeRepositories(repositories) {
  const detectedIds = new Set();
  const techById = new Map(TECH_STACK.map((tech) => [tech.id, tech]));

  const analyzedRepositories = repositories.map((repo) => {
    const techIds = detectRepositoryTech(repo);

    for (const id of techIds) {
      detectedIds.add(id);
    }

    return {
      ...repo,
      detectedTech: techIds.map((id) => techById.get(id)).filter(Boolean)
    };
  });

  // GitHub-hosted repositories are inherently Git/GitHub projects, but these are
  // kept off individual project cards to avoid noisy repeated badges.
  if (repositories.length > 0) {
    for (const tech of TECH_STACK.filter((item) => item.globalWhenReposExist)) {
      detectedIds.add(tech.id);
    }
  }

  return {
    repositories: analyzedRepositories,
    detectedTech: TECH_STACK.filter((tech) => detectedIds.has(tech.id))
  };
}

function detectRepositoryTech(repo) {
  const languageSet = new Set(
    [repo.language, ...Object.keys(repo.languages || {})]
      .filter(Boolean)
      .map((item) => item.toLowerCase())
  );
  const topicSet = new Set((repo.topics || []).map((topic) => topic.toLowerCase()));
  const rootNameSet = new Set(
    (repo.analysis?.rootEntries || []).map((entry) => entry.name.toLowerCase())
  );
  const dependencySet = getDependencySet(repo.analysis?.files || {});
  const contentPool = [
    ...Object.values(repo.analysis?.files || {}),
    repo.readme || ''
  ].join('\n').toLowerCase();
  const repoText = [repo.name, repo.description, repo.homepage]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return TECH_STACK.filter((tech) => {
    if (tech.globalWhenReposExist) {
      return false;
    }

    return (
      containsAny(languageSet, tech.languages) ||
      containsAny(topicSet, tech.topics) ||
      containsAny(rootNameSet, tech.files) ||
      containsAny(dependencySet, tech.packageDeps) ||
      containsText(contentPool, tech.contentPatterns) ||
      containsText(repoText, tech.topics)
    );
  }).map((tech) => tech.id);
}

function getDependencySet(files) {
  const dependencies = new Set();
  const packageJson = parseJson(files['package.json']);
  const composerJson = parseJson(files['composer.json']);

  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(packageJson?.[section] || {})) {
      dependencies.add(name.toLowerCase());
    }
  }

  for (const name of Object.keys(composerJson?.require || {})) {
    dependencies.add(name.toLowerCase());
  }

  for (const content of Object.values(files)) {
    const normalized = content.toLowerCase();
    for (const token of normalized.matchAll(/[a-z0-9@/_-]+/g)) {
      dependencies.add(token[0]);
    }
  }

  return dependencies;
}

function parseJson(content = '') {
  if (!content.trim()) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function containsAny(set, values = []) {
  return values.some((value) => set.has(value.toLowerCase()));
}

function containsText(haystack, values = []) {
  return values.some((value) => haystack.includes(value.toLowerCase()));
}

/**
 * Aggregates GitHub language byte totals into the required profile buckets.
 * React, Vue, and Node.js are framework/runtime signals inferred from repository
 * manifests and topics because GitHub does not report them as languages.
 *
 * @param {Array<Record<string, any>>} repositories
 * @returns {{ total: number, rawLanguages: Array<Record<string, any>>, languages: Array<Record<string, any>>, topLanguages: Array<Record<string, any>> }}
 */
export function calculateLanguageStats(repositories) {
  const totals = new Map();

  for (const repo of repositories) {
    const languageEntries = Object.entries(repo.languages || {});

    if (languageEntries.length === 0 && repo.language) {
      totals.set(repo.language, (totals.get(repo.language) || 0) + 1);
      continue;
    }

    for (const [language, bytes] of languageEntries) {
      totals.set(language, (totals.get(language) || 0) + bytes);
    }
  }

  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const rawLanguages = [...totals.entries()]
    .map(([name, value]) => ({
      name,
      value,
      color: getLanguageColor(name),
      percent: percentage(value, total, 1)
    }))
    .sort((a, b) => b.value - a.value);
  const languages = buildLanguageBuckets(repositories, rawLanguages);
  const bucketTotal = languages.reduce((sum, language) => sum + language.value, 0);
  const bucketLanguages = languages.map((language) => ({
    ...language,
    percent: percentage(language.value, bucketTotal, 1)
  }));

  return {
    total: bucketTotal || total,
    rawLanguages,
    languages: bucketLanguages,
    topLanguages: bucketLanguages.filter((language) => language.value > 0).slice(0, 12)
  };
}

/**
 * Ranks repositories with the profile formula:
 * 40% commit count, 25% recent activity, 20% stars, 10% size, 5% description.
 *
 * @param {Array<Record<string, any>>} repositories
 * @param {number} limit
 * @returns {Array<Record<string, any>>}
 */
export function rankTopProjects(repositories, limit = 8) {
  const activeRepos = repositories.filter((repo) => !repo.archived);
  const maxCommits = maxBy(activeRepos, (repo) => repo.commitCount || 0);
  const maxStars = maxBy(activeRepos, (repo) => repo.stargazers_count || 0);
  const maxSize = maxBy(activeRepos, (repo) => repo.size || 0);
  const now = Date.now();

  return activeRepos
    .map((repo) => {
      const daysSinceActivity = Math.max(0, (now - new Date(repo.pushed_at || repo.updated_at || 0).getTime()) / 86400000);
      const recentActivityScore = 1 / (1 + daysSinceActivity / 30);
      const descriptionScore = repo.description?.trim() ? 1 : 0;
      const score =
        normalize(repo.commitCount, maxCommits) * 0.4 +
        recentActivityScore * 0.25 +
        normalize(repo.stargazers_count, maxStars) * 0.2 +
        normalize(repo.size, maxSize) * 0.1 +
        descriptionScore * 0.05;

      return {
        ...repo,
        featuredScore: Number(score.toFixed(4))
      };
    })
    .filter((repo) => !repo.archived)
    .sort((a, b) => {
      return (
        b.featuredScore - a.featuredScore ||
        b.commitCount - a.commitCount ||
        new Date(b.updated_at || b.pushed_at || 0) - new Date(a.updated_at || a.pushed_at || 0) ||
        new Date(b.pushed_at || b.updated_at || 0) - new Date(a.pushed_at || a.updated_at || 0) ||
        b.stargazers_count - a.stargazers_count ||
        a.name.localeCompare(b.name)
      );
    })
    .slice(0, limit);
}

export function summarizeRepositoryTotals(repositories) {
  const summary = repositories.reduce(
    (summary, repo) => ({
      repositories: summary.repositories + 1,
      publicRepos: summary.publicRepos + (repo.private ? 0 : 1),
      privateRepos: summary.privateRepos + (repo.private ? 1 : 0),
      organizationRepos: summary.organizationRepos + Number(repo.owner?.type === 'Organization' || repo.sourceTags?.includes('organization')),
      stars: summary.stars + (repo.stargazers_count || 0),
      forks: summary.forks + (repo.forks_count || 0),
      watchers: summary.watchers + (repo.watchers_count || 0),
      openIssues: summary.openIssues + (repo.open_issues_count || 0),
      commits: summary.commits + (repo.commitCount || 0),
      pullRequests: summary.pullRequests + (repo.pullRequestCount || 0),
      mergedPullRequests: summary.mergedPullRequests + (repo.hasMergedPullRequest ? 1 : 0),
      contributors: summary.contributors + (repo.contributorCount || 0),
      estimatedLinesOfCode: summary.estimatedLinesOfCode + (repo.estimatedLinesOfCode || 0)
    }),
    {
      repositories: 0,
      publicRepos: 0,
      privateRepos: 0,
      organizationRepos: 0,
      stars: 0,
      forks: 0,
      watchers: 0,
      openIssues: 0,
      commits: 0,
      pullRequests: 0,
      mergedPullRequests: 0,
      issues: 0,
      reviews: 0,
      contributors: 0,
      estimatedLinesOfCode: 0
    }
  );

  return {
    ...summary,
    contributors: Math.max(...repositories.map((repo) => repo.contributorCount || 0), summary.contributors)
  };
}

export function mergeContributionStats(repositoryTotals, contributionStats = {}) {
  return {
    ...repositoryTotals,
    mergedPullRequests: Math.max(repositoryTotals.mergedPullRequests || 0, contributionStats.mergedPullRequests || 0),
    issues: contributionStats.issues || repositoryTotals.openIssues || 0,
    reviews: contributionStats.reviews || 0
  };
}

export async function generateGitHubSummarySvg({ username, repositoryTotals }, outputFile) {
  const metrics = [
    ['Total Repos', repositoryTotals.repositories],
    ['Public', repositoryTotals.publicRepos],
    ['Private', repositoryTotals.privateRepos],
    ['Org Repos', repositoryTotals.organizationRepos],
    ['Commits', repositoryTotals.commits],
    ['Merged PRs', repositoryTotals.mergedPullRequests],
    ['Issues', repositoryTotals.issues],
    ['Reviews', repositoryTotals.reviews],
    ['Stars', repositoryTotals.stars],
    ['Forks', repositoryTotals.forks],
    ['Est. LOC', repositoryTotals.estimatedLinesOfCode],
    ['Watchers', repositoryTotals.watchers]
  ];
  const width = 900;
  const height = 330;
  const cards = metrics.map(([label, value], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = 34 + col * 216;
    const y = 84 + row * 70;
    return `
      <rect x="${x}" y="${y}" width="192" height="52" rx="12" fill="#161b22" stroke="#30363d" />
      <text x="${x + 16}" y="${y + 22}" class="label">${escapeHtml(label)}</text>
      <text x="${x + 16}" y="${y + 43}" class="value">${escapeHtml(formatNumber(value || 0))}</text>
    `;
  }).join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(username)} GitHub summary</title>
  <desc id="desc">Summary of repositories, contributions, reviews, issues, stars, forks, and estimated lines of code.</desc>
  <rect width="${width}" height="${height}" rx="22" fill="#0d1117" />
  <text x="34" y="42" class="title">GitHub Engineering Summary</text>
  <text x="866" y="42" text-anchor="end" class="subtitle">auto-generated</text>
  ${cards}
  <style>
    .title { fill: #f0f6fc; font: 800 24px Arial, sans-serif; }
    .subtitle, .label { fill: #8b949e; font: 700 12px Arial, sans-serif; }
    .value { fill: #f0f6fc; font: 800 20px Arial, sans-serif; }
  </style>
</svg>
`;

  await ensureDir(path.dirname(outputFile));
  return writeFileIfChanged(outputFile, svg);
}

export async function generateTopProjectsSvg(repositories, outputFile) {
  const projects = repositories.slice(0, 5);
  const width = 900;
  const height = Math.max(180, 82 + projects.length * 74);
  const rows = projects.length > 0
    ? projects.map((repo, index) => {
      const y = 74 + index * 74;
      const tech = visibleProjectTech(repo, 3).map((item) => item.label).join(' / ') || repo.language || 'Code';
      return `
        <rect x="34" y="${y}" width="832" height="54" rx="12" fill="#161b22" stroke="#30363d" />
        <text x="54" y="${y + 23}" class="project">${escapeHtml(repo.full_name)}</text>
        <text x="54" y="${y + 42}" class="meta">${escapeHtml(tech)} • ${formatNumber(repo.commitCount)} commits • ${formatNumber(repo.stargazers_count)} stars • score ${repo.featuredScore ?? 0}</text>
      `;
    }).join('\n')
    : '<text x="450" y="110" text-anchor="middle" class="meta">Top projects appear after repository discovery</text>';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Top projects</title>
  <desc id="desc">Weighted top projects ranked by commits, recency, stars, repository size, and description quality.</desc>
  <rect width="${width}" height="${height}" rx="22" fill="#0d1117" />
  <text x="34" y="42" class="title">Top Projects</text>
  <text x="866" y="42" text-anchor="end" class="subtitle">40% commits • 25% recency • 20% stars</text>
  ${rows}
  <style>
    .title { fill: #f0f6fc; font: 800 24px Arial, sans-serif; }
    .subtitle, .meta { fill: #8b949e; font: 600 13px Arial, sans-serif; }
    .project { fill: #f0f6fc; font: 800 16px Arial, sans-serif; }
  </style>
</svg>
`;

  await ensureDir(path.dirname(outputFile));
  return writeFileIfChanged(outputFile, svg);
}

export async function generateActivityTimelineSvg(repositories, outputFile) {
  const latest = repositories
    .filter((repo) => repo.pushed_at || repo.updated_at)
    .sort((a, b) => new Date(b.updated_at || b.pushed_at) - new Date(a.updated_at || a.pushed_at))
    .slice(0, 8);
  const width = 900;
  const height = Math.max(210, 76 + latest.length * 48);
  const rows = latest.length > 0
    ? latest.map((repo, index) => {
      const y = 74 + index * 48;
      return `
        <circle cx="48" cy="${y + 5}" r="6" fill="#58a6ff" />
        <line x1="48" y1="${y + 12}" x2="48" y2="${y + 42}" stroke="#30363d" stroke-width="2" />
        <text x="68" y="${y + 2}" class="project">${escapeHtml(repo.full_name)}</text>
        <text x="68" y="${y + 22}" class="meta">Updated ${escapeHtml(formatDate(repo.updated_at || repo.pushed_at))} • pushed ${escapeHtml(formatDate(repo.pushed_at || repo.updated_at))}</text>
      `;
    }).join('\n')
    : '<text x="450" y="115" text-anchor="middle" class="meta">Activity appears after repository discovery</text>';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Activity timeline</title>
  <desc id="desc">Latest repository activity sorted by update and push dates.</desc>
  <rect width="${width}" height="${height}" rx="22" fill="#0d1117" />
  <text x="34" y="42" class="title">Activity Timeline</text>
  ${rows}
  <style>
    .title { fill: #f0f6fc; font: 800 24px Arial, sans-serif; }
    .project { fill: #f0f6fc; font: 800 15px Arial, sans-serif; }
    .meta { fill: #8b949e; font: 600 13px Arial, sans-serif; }
  </style>
</svg>
`;

  await ensureDir(path.dirname(outputFile));
  return writeFileIfChanged(outputFile, svg);
}

function buildLanguageBuckets(repositories, rawLanguages) {
  const values = new Map(LANGUAGE_BUCKETS.map((name) => [name, 0]));
  const rawMap = new Map(rawLanguages.map((language) => [normalizeLanguageName(language.name), language.value]));

  for (const [language, value] of rawMap.entries()) {
    const bucket = LANGUAGE_BUCKETS.includes(language) ? language : 'Others';
    values.set(bucket, (values.get(bucket) || 0) + value);
  }

  for (const repo of repositories) {
    const total = Object.values(repo.languages || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    const signal = Math.max(1, Math.round(total * 0.03));
    const techIds = new Set((repo.detectedTech || []).map((tech) => tech.id));

    if (techIds.has('react')) values.set('React', values.get('React') + signal);
    if (techIds.has('nodejs')) values.set('Node', values.get('Node') + signal);
    if (techIds.has('vue')) values.set('Vue', values.get('Vue') + signal);
  }

  return LANGUAGE_BUCKETS.map((name) => ({
    name,
    value: values.get(name) || 0,
    color: getLanguageColor(name),
    percent: 0
  }));
}

function normalizeLanguageName(language) {
  const normalized = String(language);
  const aliases = {
    'C#': 'C#',
    CSharp: 'C#',
    'C++': 'C++',
    Cpp: 'C++',
    JavaScript: 'JavaScript',
    TypeScript: 'TypeScript'
  };

  return aliases[normalized] || normalized;
}

function normalize(value, max) {
  if (!max) {
    return 0;
  }

  return Number(value || 0) / max;
}

function maxBy(items, getter) {
  return Math.max(0, ...items.map((item) => Number(getter(item) || 0)));
}

export async function generatePortfolioOverviewSvg({ username, repositories, detectedTech, languageStats, repositoryTotals }, outputFile) {
  const width = 900;
  const height = 330;
  const topLanguage = languageStats.topLanguages[0]?.name || 'Code';
  const latestRepo = repositories
    .filter((repo) => repo.pushed_at || repo.updated_at)
    .sort((a, b) => new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at))[0];
  const cards = [
    ['Repositories', repositoryTotals.repositories],
    ['Private Access', repositoryTotals.privateRepos],
    ['Stars', repositoryTotals.stars],
    ['Forks', repositoryTotals.forks],
    ['Commits', repositoryTotals.commits],
    ['Pull Requests', repositoryTotals.pullRequests],
    ['Tech Detected', detectedTech.length],
    ['Est. LOC', repositoryTotals.estimatedLinesOfCode]
  ];

  const cardSvg = cards
    .map(([label, value], index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = 40 + col * 205;
      const y = 116 + row * 76;
      return `
        <rect x="${x}" y="${y}" width="180" height="56" rx="12" fill="#161b22" stroke="#30363d" />
        <text x="${x + 16}" y="${y + 23}" class="metric-label">${escapeHtml(label)}</text>
        <text x="${x + 16}" y="${y + 45}" class="metric-value">${escapeHtml(formatNumber(value))}</text>
      `;
    })
    .join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(username)} portfolio overview</title>
  <desc id="desc">Automated portfolio overview generated from GitHub repository metadata.</desc>
  <rect width="${width}" height="${height}" rx="22" fill="#0d1117" />
  <rect x="24" y="24" width="852" height="282" rx="18" fill="#111827" stroke="#30363d" />
  <text x="44" y="62" class="eyebrow">AUTOMATED ENGINEERING PORTFOLIO</text>
  <text x="44" y="92" class="title">${escapeHtml(username)}</text>
  <text x="856" y="62" text-anchor="end" class="context">Top language: ${escapeHtml(topLanguage)}</text>
  <text x="856" y="92" text-anchor="end" class="context">Latest push: ${escapeHtml(latestRepo?.name || 'waiting for data')}</text>
  ${cardSvg}
  <text x="44" y="280" class="footer">Generated from REST + GraphQL API data, repository manifests, language bytes, permissions, and contribution signals.</text>
  <style>
    .eyebrow { fill: #58a6ff; font: 700 12px Arial, sans-serif; letter-spacing: 1px; }
    .title { fill: #f0f6fc; font: 800 28px Arial, sans-serif; }
    .context { fill: #8b949e; font: 600 14px Arial, sans-serif; }
    .metric-label { fill: #8b949e; font: 600 12px Arial, sans-serif; }
    .metric-value { fill: #f0f6fc; font: 800 20px Arial, sans-serif; }
    .footer { fill: #8b949e; font: 600 13px Arial, sans-serif; }
  </style>
</svg>
`;

  await ensureDir(path.dirname(outputFile));
  return writeFileIfChanged(outputFile, svg);
}

export async function generateLanguageChartSvg(languageStats, outputFile) {
  const topLanguages = languageStats.languages || languageStats.topLanguages;
  const width = 900;
  const height = Math.max(210, 118 + topLanguages.length * 30);
  const chartWidth = 820;
  const chartX = 40;
  let cursorX = chartX;

  const stackedSegments = topLanguages
    .map((language) => {
      const segmentWidth = Math.max((language.percent / 100) * chartWidth, language.percent > 0 ? 3 : 0);
      const segment = `<rect x="${cursorX.toFixed(1)}" y="62" width="${segmentWidth.toFixed(1)}" height="18" fill="${language.color}" rx="5" />`;
      cursorX += segmentWidth;
      return segment;
    })
    .join('\n');

  const rows = topLanguages
    .map((language, index) => {
      const y = 116 + index * 30;
      return `
        <circle cx="52" cy="${y - 5}" r="6" fill="${language.color}" />
        <text x="70" y="${y}" class="label">${escapeHtml(language.name)}</text>
        <text x="810" y="${y}" text-anchor="end" class="value">${language.percent}%</text>
      `;
    })
    .join('\n');

  const fallbackRows =
    topLanguages.length > 0
      ? rows
      : '<text x="450" y="130" text-anchor="middle" class="muted">No public language data available</text>';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Repository language usage</title>
  <desc id="desc">Top repository languages calculated from GitHub language byte totals.</desc>
  <rect width="${width}" height="${height}" rx="18" fill="#0d1117" />
  <text x="40" y="38" class="title">Language Analysis</text>
  <rect x="${chartX}" y="62" width="${chartWidth}" height="18" fill="#30363d" rx="5" />
  ${stackedSegments}
  ${fallbackRows}
  <style>
    .title { fill: #f0f6fc; font: 700 22px Arial, sans-serif; }
    .label { fill: #c9d1d9; font: 600 16px Arial, sans-serif; }
    .value { fill: #8b949e; font: 600 15px Arial, sans-serif; }
    .muted { fill: #8b949e; font: 600 16px Arial, sans-serif; }
  </style>
</svg>
`;

  await ensureDir(path.dirname(outputFile));
  return writeFileIfChanged(outputFile, svg);
}

export async function generateContributionCalendarSvg(calendar, outputFile, username) {
  const weeks = calendar?.weeks || [];
  const cell = 11;
  const gap = 3;
  const left = 34;
  const top = 52;
  const width = Math.max(760, left + weeks.length * (cell + gap) + 28);
  const height = 178;
  const cells = [];

  weeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day) => {
      const x = left + weekIndex * (cell + gap);
      const y = top + day.weekday * (cell + gap);
      cells.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${day.color || contributionColor(day.contributionCount)}"><title>${day.date}: ${day.contributionCount} contributions</title></rect>`);
    });
  });

  const content =
    cells.length > 0
      ? cells.join('\n')
      : `<text x="${width / 2}" y="96" text-anchor="middle" class="muted">Contribution calendar appears after running with GH_TOKEN</text>`;

  const total = calendar?.totalContributions ?? 0;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(username)} contribution calendar</title>
  <desc id="desc">GitHub contribution calendar generated from the GraphQL contributionCalendar field.</desc>
  <rect width="${width}" height="${height}" rx="18" fill="#0d1117" />
  <text x="28" y="34" class="title">Contribution Calendar</text>
  <text x="${width - 28}" y="34" text-anchor="end" class="count">${total} contributions</text>
  ${content}
  <text x="28" y="158" class="axis">Less</text>
  <rect x="72" y="149" width="11" height="11" rx="2" fill="#161b22" />
  <rect x="88" y="149" width="11" height="11" rx="2" fill="#0e4429" />
  <rect x="104" y="149" width="11" height="11" rx="2" fill="#006d32" />
  <rect x="120" y="149" width="11" height="11" rx="2" fill="#26a641" />
  <rect x="136" y="149" width="11" height="11" rx="2" fill="#39d353" />
  <text x="154" y="158" class="axis">More</text>
  <style>
    .title { fill: #f0f6fc; font: 700 20px Arial, sans-serif; }
    .count { fill: #8b949e; font: 600 14px Arial, sans-serif; }
    .axis, .muted { fill: #8b949e; font: 600 13px Arial, sans-serif; }
  </style>
</svg>
`;

  await ensureDir(path.dirname(outputFile));
  return writeFileIfChanged(outputFile, svg);
}

export async function generateContributionSnakeSvg(calendar, outputFile, username) {
  const weeks = calendar?.weeks || [];
  const cell = 10;
  const gap = 4;
  const left = 28;
  const top = 50;
  const width = Math.max(760, left + weeks.length * (cell + gap) + 28);
  const height = 164;
  const activePoints = [];
  const cells = [];

  weeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day) => {
      const x = left + weekIndex * (cell + gap);
      const y = top + day.weekday * (cell + gap);
      cells.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${contributionColor(day.contributionCount)}" opacity="0.9" />`);

      if (day.contributionCount > 0) {
        activePoints.push({
          x: x + cell / 2,
          y: y + cell / 2,
          count: day.contributionCount
        });
      }
    });
  });

  const snakePoints = activePoints
    .slice(-32)
    .map((point) => `${point.x},${point.y}`)
    .join(' ');
  const snake =
    snakePoints.length > 0
      ? `
        <polyline points="${snakePoints}" fill="none" stroke="#f5d742" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" />
        <circle cx="${activePoints.at(-1).x}" cy="${activePoints.at(-1).y}" r="7" fill="#f5d742" />
        <circle cx="${activePoints.at(-1).x + 2}" cy="${activePoints.at(-1).y - 2}" r="1.3" fill="#0d1117" />
      `
      : `<text x="${width / 2}" y="92" text-anchor="middle" class="muted">Contribution snake appears after running with GH_TOKEN</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(username)} contribution snake</title>
  <desc id="desc">Contribution snake generated from GitHub contribution data.</desc>
  <rect width="${width}" height="${height}" rx="18" fill="#0d1117" />
  <text x="28" y="32" class="title">Contribution Snake</text>
  ${cells.join('\n')}
  ${snake}
  <style>
    .title { fill: #f0f6fc; font: 700 20px Arial, sans-serif; }
    .muted { fill: #8b949e; font: 600 13px Arial, sans-serif; }
  </style>
</svg>
`;

  await ensureDir(path.dirname(outputFile));
  return writeFileIfChanged(outputFile, svg);
}

export function getTechById(id) {
  return TECH_STACK.find((tech) => tech.id === id);
}

export function getLanguageColor(language) {
  if (LANGUAGE_COLORS[language]) {
    return LANGUAGE_COLORS[language];
  }

  let hash = 0;
  for (const char of language) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 55, 55);
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = l - chroma / 2;
  const [r1, g1, b1] =
    hue < 60 ? [chroma, x, 0] :
    hue < 120 ? [x, chroma, 0] :
    hue < 180 ? [0, chroma, x] :
    hue < 240 ? [0, x, chroma] :
    hue < 300 ? [x, 0, chroma] :
    [chroma, 0, x];

  return `#${[r1, g1, b1]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function contributionColor(count) {
  if (count >= 16) {
    return '#39d353';
  }
  if (count >= 8) {
    return '#26a641';
  }
  if (count >= 3) {
    return '#006d32';
  }
  if (count >= 1) {
    return '#0e4429';
  }
  return '#161b22';
}

export function projectEmoji(repo) {
  const techIds = new Set((repo.detectedTech || []).map((tech) => tech.id));
  const language = (repo.language || '').toLowerCase();

  if (techIds.has('opencv') || techIds.has('yolo')) return '🧠';
  if (techIds.has('docker') || techIds.has('linux')) return '📦';
  if (techIds.has('react') || techIds.has('nextjs') || techIds.has('vue')) return '⚛️';
  if (techIds.has('flask') || techIds.has('python') || language === 'python') return '⚙️';
  if (techIds.has('java') || language === 'java') return '☕';
  if (techIds.has('php') || language === 'php') return '◇';
  return '✨';
}

export function visibleProjectTech(repo, limit = 8) {
  return (repo.detectedTech || [])
    .filter((tech) => !tech.hideOnProjectCards)
    .slice(0, limit);
}

export function assetPath(rootDir, fileName) {
  return path.join(rootDir, 'assets', fileName);
}
