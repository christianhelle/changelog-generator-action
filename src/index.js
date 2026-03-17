'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ACTION_USER_AGENT = 'christianhelle/changelog-generator-action';
const CHLOGR_RELEASE_REPOSITORY = 'christianhelle/chlogr';

function getInput(name) {
  const key = `INPUT_${name.replace(/ /g, '_').replace(/-/g, '_').toUpperCase()}`;
  return (process.env[key] ?? '').trim();
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    return;
  }

  const stringValue = String(value);
  if (!stringValue.includes('\n') && !stringValue.includes('\r')) {
    fs.appendFileSync(outputFile, `${name}=${stringValue}${os.EOL}`, 'utf8');
    return;
  }

  const delimiter = `EOF_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  fs.appendFileSync(
    outputFile,
    `${name}<<${delimiter}${os.EOL}${stringValue}${os.EOL}${delimiter}${os.EOL}`,
    'utf8'
  );
}

function addMask(value) {
  if (value) {
    console.log(`::add-mask::${value}`);
  }
}

function escapeWorkflowMessage(value) {
  return String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

function fail(message) {
  console.error(`::error::${escapeWorkflowMessage(message)}`);
  process.exit(1);
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function getReleaseCandidates(requestedVersion) {
  const trimmed = (requestedVersion || 'latest').trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'latest') {
    return ['latest'];
  }

  const normalized = trimmed.replace(/^refs\/tags\//, '');
  const candidates = [normalized];

  if (normalized.startsWith('v') && normalized.length > 1) {
    candidates.push(normalized.slice(1));
  } else {
    candidates.push(`v${normalized}`);
  }

  return [...new Set(candidates)];
}

function getAssetName(platform, arch) {
  const key = `${platform}/${arch}`;

  switch (key) {
    case 'linux/x64':
      return 'chlogr-linux-x86_64.tar.gz';
    case 'linux/arm64':
      return 'chlogr-linux-aarch64.tar.gz';
    case 'darwin/x64':
      return 'chlogr-macos-x86_64.tar.gz';
    case 'darwin/arm64':
      return 'chlogr-macos-aarch64.tar.gz';
    case 'win32/x64':
      return 'chlogr-windows-x86_64.zip';
    default:
      throw new Error(
        `Unsupported runner platform "${platform}" with architecture "${arch}".`
      );
  }
}

async function fetchJson(url, token, allowNotFound) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': ACTION_USER_AGENT,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers,
    redirect: 'follow',
  });

  if (allowNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const details = truncate(await response.text(), 400);
    throw new Error(
      `GitHub API request failed with status ${response.status} for ${url}. ${details || ''}`.trim()
    );
  }

  return response.json();
}

async function resolveRelease(requestedVersion, token) {
  const candidates = getReleaseCandidates(requestedVersion);

  if (candidates[0] === 'latest') {
    return fetchJson(
      `https://api.github.com/repos/${CHLOGR_RELEASE_REPOSITORY}/releases/latest`,
      token,
      false
    );
  }

  for (const candidate of candidates) {
    const release = await fetchJson(
      `https://api.github.com/repos/${CHLOGR_RELEASE_REPOSITORY}/releases/tags/${encodeURIComponent(candidate)}`,
      token,
      true
    );

    if (release) {
      return release;
    }
  }

  throw new Error(`Could not find a chlogr release matching "${requestedVersion}".`);
}

async function downloadFile(url, destination) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': ACTION_USER_AGENT,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}. HTTP ${response.status}.`);
  }

  const content = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, content);
}

function quotePowerShellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}${output ? `\n${output}` : ''}`
    );
  }

  return result;
}

function extractArchive(archivePath, destination) {
  fs.mkdirSync(destination, { recursive: true });

  if (archivePath.endsWith('.zip')) {
    const command = `Expand-Archive -LiteralPath ${quotePowerShellLiteral(archivePath)} -DestinationPath ${quotePowerShellLiteral(destination)} -Force`;
    runCommand('powershell', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command]);
    return;
  }

  if (archivePath.endsWith('.tar.gz')) {
    runCommand('tar', ['-xzf', archivePath, '-C', destination]);
    return;
  }

  throw new Error(`Unsupported archive format: ${archivePath}`);
}

function findFile(root, fileName) {
  const directories = [root];

  while (directories.length > 0) {
    const current = directories.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        directories.push(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name === fileName) {
        return entryPath;
      }
    }
  }

  return null;
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

function buildChlogrArguments(config) {
  const args = ['--repo', config.repo, '--output', config.outputPath];

  if (config.token) {
    args.push('--token', config.token);
  }

  if (config.sinceTag) {
    args.push('--since-tag', config.sinceTag);
  }

  if (config.untilTag) {
    args.push('--until-tag', config.untilTag);
  }

  if (config.excludeLabels) {
    args.push('--exclude-labels', config.excludeLabels);
  }

  return args;
}

function sanitizeArguments(args) {
  return args.map((value, index) => (args[index - 1] === '--token' ? '***' : value));
}

function runChlogr(executablePath, args, workspace, token) {
  const env = { ...process.env };

  if (token && !env.GITHUB_TOKEN) {
    env.GITHUB_TOKEN = token;
  }

  const result = spawnSync(executablePath, args, {
    cwd: workspace,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const safeArgs = sanitizeArguments(args);
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(
      `chlogr exited with code ${result.status}: ${path.basename(executablePath)} ${safeArgs.join(' ')}${output ? `\n${output}` : ''}`
    );
  }
}

async function main() {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const repo = getInput('repo') || process.env.GITHUB_REPOSITORY;
  const token = getInput('github-token');
  const outputInput = getInput('output') || 'CHANGELOG.md';
  const sinceTag = getInput('since-tag');
  const untilTag = getInput('until-tag');
  const excludeLabels = getInput('exclude-labels');
  const requestedVersion = getInput('chlogr-version') || 'latest';

  if (!repo || !repo.includes('/')) {
    throw new Error('The "repo" input must be set to a GitHub repository in owner/repo format.');
  }

  if (token) {
    addMask(token);
  }

  const outputPath = path.isAbsolute(outputInput)
    ? outputInput
    : path.resolve(workspace, outputInput);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const previousContent = readFileIfExists(outputPath);
  const assetName = getAssetName(process.platform, process.arch);

  console.log(`Resolving chlogr ${requestedVersion} for ${process.platform}/${process.arch}`);
  const release = await resolveRelease(requestedVersion, token);
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const asset = assets.find((entry) => entry.name === assetName);

  if (!asset) {
    const availableAssets = assets.map((entry) => entry.name).join(', ');
    throw new Error(
      `Release ${release.tag_name} does not contain ${assetName}. Available assets: ${availableAssets}`
    );
  }

  console.log(`Using chlogr ${release.tag_name} from ${asset.name}`);

  const tempRoot = fs.mkdtempSync(
    path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'chlogr-action-')
  );

  try {
    const archivePath = path.join(tempRoot, asset.name);
    const extractPath = path.join(tempRoot, 'extract');
    const executableName = process.platform === 'win32' ? 'chlogr.exe' : 'chlogr';

    await downloadFile(asset.browser_download_url, archivePath);
    extractArchive(archivePath, extractPath);

    const executablePath = findFile(extractPath, executableName);
    if (!executablePath) {
      throw new Error(`The ${asset.name} archive did not contain ${executableName}.`);
    }

    if (process.platform !== 'win32') {
      fs.chmodSync(executablePath, 0o755);
    }

    const args = buildChlogrArguments({
      repo,
      token,
      outputPath,
      sinceTag,
      untilTag,
      excludeLabels,
    });

    console.log(`Generating changelog for ${repo}`);
    runChlogr(executablePath, args, workspace, token);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`chlogr completed without creating ${outputPath}.`);
  }

  const nextContent = fs.readFileSync(outputPath, 'utf8');
  const changed = previousContent !== nextContent;

  setOutput('changelog-path', outputPath);
  setOutput('changed', changed ? 'true' : 'false');
  setOutput('chlogr-version', release.tag_name);

  console.log(`Changelog written to ${outputPath}`);
  console.log(`Changed: ${changed}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
