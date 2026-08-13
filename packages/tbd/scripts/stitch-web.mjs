#!/usr/bin/env node

/** Build the browser sources into the single HTML artifact served by `tbd web`. */

import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeFile } from 'atomically';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(scriptDir, '..');
const sourceDir = join(packageDir, 'src', 'web');
const outputDir = join(packageDir, 'dist', 'web');
const styleMarker = '/*__TBD_WEB_STYLES__*/';
const scriptMarker = '/*__TBD_WEB_SCRIPT__*/';

function replaceExactlyOnce(source, marker, replacement) {
  const pieces = source.split(marker);
  if (pieces.length !== 2) {
    throw new Error(`Expected exactly one ${marker} marker in the web template`);
  }
  return `${pieces[0]}${replacement}${pieces[1]}`;
}

const [template, styles, bundledScript] = await Promise.all([
  readFile(join(sourceDir, 'index.html'), 'utf8'),
  readFile(join(sourceDir, 'styles.css'), 'utf8'),
  readFile(join(outputDir, 'client.iife.js'), 'utf8'),
]);

// The source map remains useful beside the intermediate browser bundle, but a mapping
// comment inside the stitched page points at the wrong URL. Guard against accidental
// closing tags as source strings evolve.
const script = bundledScript
  .replace(/\n?\/\/# sourceMappingURL=.*?(?:\n|$)/gu, '\n')
  .replace(/<\/script/giu, '<\\/script');
const pageWithStyles = replaceExactlyOnce(template, styleMarker, styles.trim());
const page = replaceExactlyOnce(pageWithStyles, scriptMarker, script.trim());

await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'index.html'), page);
