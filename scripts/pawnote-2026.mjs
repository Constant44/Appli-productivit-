// Pronote 2026 envoie le défi d'authentification en clair : il faut le chiffrer tel quel
// (comme pronotepy 2.15.7). pawnote 1.6.2 le déchiffre d'abord (ancien protocole), ce qui échoue.
// On charge une copie corrigée de pawnote (node_modules reste intact).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(dirname(createRequire(import.meta.url).resolve("pawnote")), "index.mjs");
let s = readFileSync(src, "utf8");
const m = s.match(/(\w+)=\((\w+),(\w+),(\w+)\)=>\{const (\w+)=(\w+(?:\.default)?)\.util\.createBuffer\(\2\.information\.aesIV\);try\{/);
if (!m) throw new Error("pawnote : version inattendue, correctif Pronote 2026 non appliqué");
const [all, , e, ch, key, , forge] = m;
const catchIdx = s.indexOf("}catch{throw new ", s.indexOf(all) + all.length);
const endIdx = s.indexOf("}", catchIdx + 1);
const err = s.slice(catchIdx + "}catch{throw new ".length, endIdx);
const aes = s.match(/(\w+)=class\{static decrypt\(/)[1];
// Le déchiffrement de l'ancien protocole « réussit » même avec une mauvaise clé (padding non vérifié) :
// on remplace donc le corps entier par le nouveau calcul.
const fnStart = s.indexOf(all);
s = s.slice(0, fnStart)
  + `${m[1]}=(${e},${ch},${key})=>{try{return ${aes}.encrypt(${forge}.util.encodeUtf8(${ch}.challenge),${key},${forge}.util.createBuffer(${e}.information.aesIV))}catch{throw new ${err}}`
  + s.slice(endIdx + 1);
const out = join(here, ".cache", "pawnote.mjs");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, s);
export default await import(pathToFileURL(out).href);
