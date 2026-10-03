#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY = 'MicrosoftDocs/azure-devops-docs';
const REVISION = 'main';
const MAIN_SOURCE_PATH = 'docs/pipelines/build/variables.md';
const RAW_BASE = `https://raw.githubusercontent.com/${REPOSITORY}/${REVISION}/`;
const GITHUB_BASE = `https://github.com/${REPOSITORY}/blob/${REVISION}/`;
const MICROSOFT_TRACKING_QUERY = 'wt.mc_id=DT-MVP-5005372';
const DOCS_BASE =
  `https://learn.microsoft.com/en-gb/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml&${MICROSOFT_TRACKING_QUERY}`;
const OUTPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/catalog/generatedPredefinedVariables.ts',
);

export async function retrieveSources(fetchImplementation = fetch) {
  const cache = new Map();

  async function retrieve(sourcePath) {
    const normalizedPath = path.posix.normalize(sourcePath);
    const cached = cache.get(normalizedPath);
    if (cached !== undefined) {
      return cached;
    }

    const response = await fetchImplementation(`${RAW_BASE}${normalizedPath}`, {
      headers: { 'User-Agent': 'AzurePipelinesFieldGuide-variable-generator' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Failed to retrieve ${normalizedPath}: HTTP ${response.status}`);
    }

    const markdown = await response.text();
    cache.set(normalizedPath, markdown);
    return markdown;
  }

  const main = await retrieve(MAIN_SOURCE_PATH);
  return expandIncludes(main, MAIN_SOURCE_PATH, retrieve);
}

async function expandIncludes(markdown, sourcePath, retrieve) {
  const includePattern = /\[!INCLUDE\s+\[[^\]]*\]\(([^)]+\.md)\)\]/gi;
  let expanded = markdown;

  for (const match of markdown.matchAll(includePattern)) {
    const includeReference = match[1];
    if (includeReference === undefined || match[0] === undefined) {
      continue;
    }
    const includePath = path.posix.normalize(
      path.posix.join(path.posix.dirname(sourcePath), includeReference),
    );
    const include = await retrieve(includePath);
    const expandedInclude = await expandIncludes(include, includePath, retrieve);
    const lineStart = markdown.lastIndexOf('\n', match.index) + 1;
    const lineEnd = markdown.indexOf('\n', match.index);
    const containingLine = markdown.slice(lineStart, lineEnd === -1 ? markdown.length : lineEnd);
    const replacement = containingLine.startsWith('|')
      ? normalizeDescription(removeFrontMatter(expandedInclude))
      : expandedInclude;
    expanded = expanded.replace(match[0], replacement);
  }

  return expanded;
}

export function parsePredefinedVariables(mainMarkdown) {
  const variables = new Map();

  for (const variable of parseVariableTables(mainMarkdown)) {
    variables.set(variable.name.toLowerCase(), variable);
  }

  for (const name of ['Build.Clean', 'System.Debug']) {
    const special = parseVariableHeading(mainMarkdown, name);
    if (special !== undefined) {
      variables.set(name.toLowerCase(), special);
    }
  }

  const diagnosticDescription = findParagraph(mainMarkdown, 'Agent.Diagnostic');
  if (diagnosticDescription !== undefined) {
    variables.set('agent.diagnostic', {
      name: 'Agent.Diagnostic',
      description: diagnosticDescription,
      availableInTemplates: false,
      documentationUrl: `${DOCS_BASE}#systemdebug`,
    });
  }

  const result = [...variables.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'en'),
  );
  validateVariables(result);
  return result;
}

export function parseVariableTables(markdown) {
  const lines = markdown.split(/\r?\n/);
  const variables = [];
  let pendingAnchor;
  let section;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const anchor = /<a\s+(?:id|name)=["']([^"']+)["'][^>]*>/i.exec(line)?.[1];
    if (anchor !== undefined) {
      pendingAnchor = anchor;
      if (section !== undefined && section.rowCount === 0) {
        section.anchor = anchor;
      }
      continue;
    }

    const heading = /^##\s+(.+?)\s*$/.exec(line)?.[1];
    if (heading !== undefined) {
      section = {
        anchor: pendingAnchor ?? headingAnchor(heading),
        rowCount: 0,
      };
      pendingAnchor = undefined;
      continue;
    }

    if (section === undefined || !/^\|\s*Variable\s*\|/i.test(line)) {
      continue;
    }

    index += 2;
    while (index < lines.length && /^\|/.test(lines[index] ?? '')) {
      const cells = splitTableRow(lines[index] ?? '');
      const name = normalizeVariableName(cells[0] ?? '');
      const description = normalizeDescription(cells[1] ?? '');
      if (name !== undefined && description !== '') {
        const templateValue = (cells[2] ?? '').trim().toLowerCase();
        variables.push({
          name,
          description,
          // Microsoft documents that variables not marked as available do not
          // render in template scope. Tables without the column therefore mean No.
          availableInTemplates: templateValue === 'yes',
          documentationUrl: `${DOCS_BASE}#${section.anchor}`,
        });
        section.rowCount += 1;
      }
      index += 1;
    }
    index -= 1;
  }

  return variables;
}

function parseVariableHeading(markdown, name) {
  const escapedName = name.replaceAll('.', '\\.');
  const pattern = new RegExp(`^##\\s+${escapedName}\\s*$`, 'im');
  const match = pattern.exec(markdown);
  if (match?.index === undefined) {
    return undefined;
  }

  const bodyStart = match.index + match[0].length;
  const remaining = markdown.slice(bodyStart);
  const nextHeading = /^#{1,2}\s+/m.exec(remaining);
  const body = remaining.slice(0, nextHeading?.index ?? remaining.length);
  const description = firstProseParagraph(body);
  if (description === undefined) {
    return undefined;
  }

  return {
    name,
    description,
    availableInTemplates: false,
    documentationUrl: `${DOCS_BASE}#${name.toLowerCase().replaceAll('.', '')}`,
  };
}

function findParagraph(markdown, variableName) {
  return markdown
    .split(/\r?\n\s*\r?\n/)
    .filter((paragraph) => paragraph.includes(variableName))
    .map(normalizeDescription)
    .find((paragraph) => paragraph.length > variableName.length && !paragraph.startsWith('#'));
}

function firstProseParagraph(markdown) {
  return markdown
    .split(/\r?\n\s*\r?\n/)
    .map(normalizeDescription)
    .find(
      (paragraph) =>
        paragraph !== '' &&
        !paragraph.startsWith(':::') &&
        !paragraph.startsWith('[!') &&
        !paragraph.startsWith('```'),
    );
}

function splitTableRow(row) {
  return row
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll('\\|', '|'));
}

function removeFrontMatter(markdown) {
  return markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '');
}

function normalizeVariableName(value) {
  const name = value.replaceAll('`', '').replace(/<[^>]+>/g, '').trim();
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name) ? name : undefined;
}

export function normalizeDescription(value) {
  return value
    .replace(/`([^`]*)`/g, (_match, code) =>
      `\`${code.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}\``,
    )
    .replace(/\[!INCLUDE[^\]]*\]/gi, '')
    .replace(/:::image[^:]*:::/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(?:ul|ol)>/gi, ' ')
    .replace(/<li>/gi, ' • ')
    .replace(/<\/li>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function headingAnchor(heading) {
  return heading
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function validateVariables(variables) {
  if (variables.length < 80) {
    throw new Error(`Expected at least 80 variables, parsed ${variables.length}.`);
  }
  for (const prefix of ['Agent.', 'Build.', 'Pipeline.', 'System.']) {
    if (!variables.some(({ name }) => name.startsWith(prefix))) {
      throw new Error(`No ${prefix} variables were parsed.`);
    }
  }
  for (const variable of variables) {
    if (typeof variable.availableInTemplates !== 'boolean') {
      throw new Error(`${variable.name} does not have explicit template availability.`);
    }
    if (!variable.documentationUrl.includes('#')) {
      throw new Error(`${variable.name} does not have an anchored documentation URL.`);
    }
    if (!variable.documentationUrl.includes(MICROSOFT_TRACKING_QUERY)) {
      throw new Error(`${variable.name} does not have the expected documentation tracking query.`);
    }
  }
}

export function renderCatalog(variables) {
  return `// Generated by scripts/update-predefined-variables.mjs. Do not edit manually.\n` +
    `// Source: ${GITHUB_BASE}${MAIN_SOURCE_PATH}\n\n` +
    `export const generatedPredefinedVariables = ${JSON.stringify(variables, null, 2)} as const;\n`;
}

async function run() {
  const check = process.argv.includes('--check');
  const source = await retrieveSources();
  const output = renderCatalog(parsePredefinedVariables(source));

  if (check) {
    const existing = await readFile(OUTPUT_PATH, 'utf8');
    if (existing !== output) {
      throw new Error('The generated variable catalog is stale. Run npm run update:variables.');
    }
    console.log('The generated variable catalog is current.');
    return;
  }

  await writeFile(OUTPUT_PATH, output, 'utf8');
  console.log(`Updated ${path.relative(process.cwd(), OUTPUT_PATH)}.`);
}

const invokedPath = process.argv[1] === undefined ? undefined : pathToFileURL(process.argv[1]).href;
if (invokedPath === import.meta.url) {
  await run();
}
