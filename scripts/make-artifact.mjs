// Transforme dist-artifact/index.html (fichier unique) en page publiable sur claude.ai :
// l'hébergeur ajoute lui-même doctype/head/body, on ne garde que titre, polices, styles, racine et script.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("dist-artifact/index.html", "utf8");
const grab = (re) => [...html.matchAll(re)].map((m) => m[0]);
const styles = grab(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = grab(/<script[^>]*>[\s\S]*?<\/script>/g);
const fonts = grab(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts\.googleapis\.com[^"]*"[^>]*>/g);
const page = [
  "<title>Cadence</title>",
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<meta name="theme-color" content="#0f1522">',
  ...fonts,
  ...styles,
  '<div id="root"></div>',
  ...scripts,
].join("\n");
writeFileSync("dist-artifact/prepa-fc.html", page);
console.log(`dist-artifact/prepa-fc.html : ${(page.length / 1024).toFixed(0)} Kio`);
