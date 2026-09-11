import fs from 'fs';
import path from 'path';

let emojiCount = 0;
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

function scanDirectory(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.endsWith('.js') || entry.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (emojiRegex.test(content)) {
        console.error(`EMOJI DETECTED in: ${fullPath}`);
        emojiCount++;
      }
    }
  }
}

scanDirectory('src');
if (emojiCount === 0) {
  console.log('ZERO EMOJIS CONFIRMED ACROSS ALL SRC FILES!');
} else {
  console.error(`TOTAL EMOJIS FOUND: ${emojiCount}`);
  process.exit(1);
}
