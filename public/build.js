const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = __dirname;
const distDir = path.join(rootDir, "dist");

const jsFiles = [
  "script.js",
  "js/app.js",
  "js/config/supabase.js",
  "js/config/collectibles.js",
  "js/modules/campus.js",
  "js/modules/coleccion.js",
  "js/modules/tienda.js",
  "js/modules/perfil.js",
  "js/modules/ranking.js"
];

const entriesToCopy = [
  "index.html",
  "script.js",
  "css",
  "js",
  "assets"
];

function checkJavaScript() {
  for (const file of jsFiles) {
    execFileSync("node", ["--check", file], {
      cwd: rootDir,
      stdio: "inherit"
    });
  }
}

function copyEntry(entry) {
  const source = path.join(rootDir, entry);
  const target = path.join(distDir, entry);

  if (!fs.existsSync(source)) {
    return;
  }

  fs.cpSync(source, target, {
    recursive: true,
    force: true
  });
}

function build() {
  checkJavaScript();

  fs.rmSync(distDir, {
    recursive: true,
    force: true
  });

  fs.mkdirSync(distDir, {
    recursive: true
  });

  for (const entry of entriesToCopy) {
    copyEntry(entry);
  }

  console.log("Build complete: dist/");
}

build();
