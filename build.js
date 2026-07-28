import fs from 'fs';
import path from 'path';

const srcDir = './src/html';
const outputHtml = './dist/popup.html';

function loadComponent(fileName) {
  const filePath = path.join(srcDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Component file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8').trim();
}

function compileHtml(fileName, stack = []) {
  if (stack.includes(fileName)) {
    throw new Error(`Circular include: ${[...stack, fileName].join(' -> ')}`);
  }
  let content = loadComponent(fileName);
  const regex = /<!-- INCLUDE ([\w.-]+) -->/g;

  // Replace all INCLUDE tags recursively
  while (content.match(regex)) {
    content = content.replace(regex, (m, includeFile) => {
      return compileHtml(includeFile, [...stack, fileName]);
    });
  }
  return content;
}

// Balance-check every stylesheet. A stray brace silently discards every rule
// after it, which no linter or unit test in this project would catch.
function checkStylesheets(dir) {
  const problems = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.css')) continue;
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    let depth = 0;
    let line = 1;
    let inComment = false;
    const opened = [];
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      const next = src[i + 1];
      if (ch === '\n') line++;
      if (!inComment && ch === '/' && next === '*') { inComment = true; i++; continue; }
      if (inComment && ch === '*' && next === '/') { inComment = false; i++; continue; }
      if (inComment) continue;
      if (ch === '{') { depth++; opened.push(line); }
      else if (ch === '}') {
        depth--;
        opened.pop();
        if (depth < 0) { problems.push(`${file}: unmatched '}' at line ${line}`); depth = 0; }
      }
    }
    if (depth > 0) problems.push(`${file}: unclosed '{' opened at line ${opened.join(', ')}`);
  }
  return problems;
}

try {
  console.log('Checking stylesheets...');
  const cssProblems = checkStylesheets('./popup/styles');
  if (cssProblems.length > 0) {
    throw new Error(`Malformed CSS:\n  ${cssProblems.join('\n  ')}`);
  }

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
