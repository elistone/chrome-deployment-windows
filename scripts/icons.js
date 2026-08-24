#!/usr/bin/env node
/**
 * Draw the toolbar icons.
 *
 * The icons this replaced were stock clip-art - a cardboard box and a delivery
 * truck - inherited from v1. They had nothing to do with the extension's look,
 * and nothing to do with what they were reporting either: "box versus truck" is
 * not "closed versus open", so the one thing the toolbar is there to tell you
 * had to be learned rather than seen.
 *
 * The geometry lives here rather than in three hand-drawn SVG files so that the
 * three states cannot drift apart. Each is the same disc at the same size with
 * the same stroke weight; only the tone and the glyph change, which is what
 * makes them read as one family. Everything is sized for 16px first - at that
 * size only the silhouette and the colour survive, so the glyphs are single
 * strokes with nothing inside them to lose.
 *
 * Run with `pnpm icons`. The PNGs are committed, so this only needs running
 * when the artwork changes.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'icons')
/**
 * The vector source, kept outside public/ so it is not copied into the shipped
 * extension. It is written out purely so the artwork is inspectable without
 * running anything.
 */
const SOURCE = path.join(ROOT, 'assets', 'icons')

/**
 * Every size Chrome asks for. Kept in step with ICON_SIZES in src/app/icons.ts
 * by tests/icons.test.ts - this file has to run as plain JavaScript outside the
 * bundle, so it cannot import it.
 */
export const SIZES = [16, 32, 48, 128]

/**
 * Tones, lifted from the palettes in src/styles/tokens.css.
 *
 * Each is a pair rather than a flat fill: the light end at the top and the base
 * at the bottom is enough to keep the 128 from looking like a sticker without
 * costing anything at 16, where the gradient is under a pixel of difference.
 */
const TONES = {
  default: { from: '#7c83f7', to: '#4f46e5' },
  success: { from: '#22b573', to: '#0e7c50' },
  error: { from: '#e04d63', to: '#bd2e46' },
}

/**
 * The glyphs, on a 128 grid.
 *
 * default - a ring: an aperture, a window. It is the extension's own mark, so
 *   it is the one that has to work in the Web Store and the extensions list.
 * success - a chevron up: ship it.
 * error   - a bar: the universal "not through here".
 *
 * A copy of src/app/glyphs.ts, which is where the rest of the extension reads
 * them from. This file has to run as plain JavaScript outside the bundle, so it
 * cannot import that one; tests/icons.test.ts asserts the two still agree, and
 * fails if either is changed alone.
 */
export const GLYPHS = {
  default: { d: 'M64 37a27 27 0 1 0 0 54 27 27 0 1 0 0-54', width: 13 },
  success: { d: 'M40 76 64 48 88 76', width: 14 },
  error: { d: 'M38 64H90', width: 14 },
}

export function svgFor(state) {
  const { from, to } = TONES[state]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="60" fill="url(#g)"/>
  <path d="${GLYPHS[state].d}" fill="none" stroke="#fff" stroke-width="${GLYPHS[state].width}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

async function main() {
  // Imported lazily: this is a devDependency used by the e2e suite, and the
  // script is not part of any build that runs without it.
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await fs.mkdir(SOURCE, { recursive: true })

  for (const state of Object.keys(TONES)) {
    const dir = path.join(OUT, state)
    await fs.mkdir(dir, { recursive: true })
    const svg = svgFor(state)
    await fs.writeFile(path.join(SOURCE, `${state}.svg`), `${svg}\n`)

    for (const size of SIZES) {
      await page.setViewportSize({ width: size, height: size })
      await page.setContent(
        `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
      )
      const png = await page.screenshot({ omitBackground: true })
      await fs.writeFile(path.join(dir, `icon${size}.png`), png)
    }
    console.log(`  ${state}: ${SIZES.map((s) => `icon${s}.png`).join(', ')}`)
  }

  await browser.close()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
