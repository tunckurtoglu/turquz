#!/usr/bin/env node
// scripts/generate-app-icons.js
// Turquz uygulama ikonlarını üretir (açık + koyu zemin).
// Gereksinim: python3 + pillow (venv ile bir kez: python3 -m venv .venv-icon && .venv-icon/bin/pip install pillow)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pyPath = path.join(__dirname, 'generate-app-icons.py');
const root = path.join(__dirname, '..');
const venvPy = path.join(root, '.venv-icon', 'bin', 'python3');
const pyBin = fs.existsSync(venvPy) ? venvPy : 'python3';

try {
  execSync(`${pyBin} -c "from PIL import Image"`, { cwd: root, stdio: 'pipe' });
} catch {
  console.error('Pillow gerekli: python3 -m venv .venv-icon && .venv-icon/bin/pip install pillow');
  process.exit(1);
}

execSync(`${pyBin} "${pyPath}"`, { cwd: root, stdio: 'inherit' });
