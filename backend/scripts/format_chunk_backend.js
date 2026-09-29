import fs from 'fs';

const chunkPath = 'D:\\WORK\\FullStack-EMS\\client\\dist\\assets\\FieldOperations-B_4RP-of.js';
const code = fs.readFileSync(chunkPath, 'utf8');

// Basic formatting to split lines by semicolons and curly braces
let formatted = '';
let indent = 0;
for (let i = 0; i < code.length; i++) {
  const char = code[i];
  if (char === ';') {
    formatted += ';\n' + '  '.repeat(indent);
  } else if (char === '{') {
    indent++;
    formatted += ' {\n' + '  '.repeat(indent);
  } else if (char === '}') {
    indent = Math.max(0, indent - 1);
    formatted += '\n' + '  '.repeat(indent) + '}';
  } else {
    formatted += char;
  }
}

fs.writeFileSync('D:\\WORK\\FullStack-EMS\\backend\\scripts\\formatted_chunk.js', formatted, 'utf8');
console.log('Formatted chunk written to formatted_chunk.js. Lines:', formatted.split('\n').length);
