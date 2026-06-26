import fs from 'fs';
import path from 'path';

const srcDir = './src/html';
const outputHtml = './popup/popup.html';

function loadComponent(fileName) {
  const filePath = path.join(srcDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Component file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8').trim();
}

function compileHtml(fileName) {
  let content = loadComponent(fileName);
  const regex = /<!-- INCLUDE ([\w\.-]+) -->/g;
  
  // Replace all INCLUDE tags recursively
  while (content.match(regex)) {
    content = content.replace(regex, (m, includeFile) => {
      return compileHtml(includeFile);
    });
  }
  return content;
}

try {
  console.log('Building popup.html...');
  const compiled = compileHtml('base.html');

  // Ensure target folder exists
  const targetDir = path.dirname(outputHtml);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(outputHtml, compiled);
  console.log('Successfully compiled popup.html');
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
