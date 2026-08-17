#!/usr/bin/env node
/**
 * Zip dist/ into an uploadable package. Replaces the old gulp + gulp-zip task.
 *
 * Run "pnpm build" first; this script only packages what is already in dist/.
 */
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'

const root = path.resolve(import.meta.dirname, '..')
const distPath = path.join(root, 'dist')
const releasePath = path.join(root, 'release')

if (!fs.existsSync(path.join(distPath, 'manifest.json'))) {
  console.error('No build found in dist/. Run "pnpm build" first.')
  process.exit(1)
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(distPath, 'manifest.json'), 'utf8'),
)

/** Lowercase, hyphen separated, no characters that upset a filename. */
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const zip = new JSZip()
let fileCount = 0

function addDirectory(absolute, relative = '') {
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const entryAbsolute = path.join(absolute, entry.name)
    const entryRelative = relative ? `${relative}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      addDirectory(entryAbsolute, entryRelative)
      continue
    }

    // Source maps are useful locally but only bloat the uploaded package.
    if (entry.name.endsWith('.map')) {
      continue
    }

    zip.file(entryRelative, fs.readFileSync(entryAbsolute))
    fileCount += 1
  }
}

addDirectory(distPath)

const zipName = `${slugify(manifest.name)}-v${manifest.version}.zip`
const target = path.join(releasePath, zipName)

fs.mkdirSync(releasePath, { recursive: true })
const contents = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
})
fs.writeFileSync(target, contents)

const sizeKb = (contents.byteLength / 1024).toFixed(1)
console.log(`Packaged ${fileCount} files into release/${zipName} (${sizeKb} KB)`)
