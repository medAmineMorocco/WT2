const fs = require('fs');
const path = require('path');

const treeSitterBinding = path.resolve(
  __dirname,
  '../../release/app/node_modules/tree-sitter/binding.gyp',
);
const treeSitterQuery = path.resolve(
  __dirname,
  '../../release/app/node_modules/tree-sitter/src/query.cc',
);

if (!fs.existsSync(treeSitterBinding)) {
  throw new Error(
    `tree-sitter binding.gyp was not found at ${treeSitterBinding}`,
  );
}
if (!fs.existsSync(treeSitterQuery)) {
  throw new Error(`tree-sitter query.cc was not found at ${treeSitterQuery}`);
}

const bindingGyp = fs.readFileSync(treeSitterBinding, 'utf8');
const cxx17Occurrences = bindingGyp.match(/c\+\+17/g) || [];

if (cxx17Occurrences.length > 0) {
  fs.writeFileSync(
    treeSitterBinding,
    bindingGyp.replace(/c\+\+17/g, 'c++20'),
    'utf8',
  );
} else if (!bindingGyp.includes('c++20')) {
  throw new Error(
    'tree-sitter binding.gyp contains neither C++17 nor C++20 compiler settings',
  );
}

const querySource = fs.readFileSync(treeSitterQuery, 'utf8');
const ambiguousIndexOccurrences =
  querySource.match(/result\[1\] = js_nodes;/g) || [];

if (ambiguousIndexOccurrences.length > 0) {
  fs.writeFileSync(
    treeSitterQuery,
    querySource.replace(/result\[1\] = js_nodes;/g, 'result[1U] = js_nodes;'),
    'utf8',
  );
} else if (!querySource.includes('result[1U] = js_nodes;')) {
  throw new Error(
    'tree-sitter query.cc does not contain the expected result index',
  );
}

console.log(
  `Prepared tree-sitter native sources (${cxx17Occurrences.length} C++ settings, ${ambiguousIndexOccurrences.length} array indices updated)`,
);
