const fs = require('fs');
const path = require('path');

const treeSitterBinding = path.resolve(
  __dirname,
  '../../release/app/node_modules/tree-sitter/binding.gyp',
);

if (!fs.existsSync(treeSitterBinding)) {
  throw new Error(`tree-sitter binding.gyp was not found at ${treeSitterBinding}`);
}

const bindingGyp = fs.readFileSync(treeSitterBinding, 'utf8');
const cxx17Occurrences = bindingGyp.match(/c\+\+17/g) || [];

if (cxx17Occurrences.length === 0) {
  if (!bindingGyp.includes('c++20')) {
    throw new Error(
      'tree-sitter binding.gyp contains neither C++17 nor C++20 compiler settings',
    );
  }

  console.log('tree-sitter is already configured to compile as C++20');
  process.exit(0);
}

fs.writeFileSync(
  treeSitterBinding,
  bindingGyp.replace(/c\+\+17/g, 'c++20'),
  'utf8',
);

console.log(
  `Updated ${cxx17Occurrences.length} tree-sitter compiler settings to C++20`,
);
