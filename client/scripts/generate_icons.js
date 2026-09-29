import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');
const faviconPath = path.join(publicDir, 'favicon.svg');

// Locate Chrome Executable on Windows
const getChromePath = () => {
  const commonPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback to checking registry or path
  try {
    const regQuery = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve', { encoding: 'utf8' });
    const match = regQuery.match(/REG_SZ\s+(.+)/);
    if (match && fs.existsSync(match[1].trim())) {
      return match[1].trim();
    }
  } catch (e) {
    // Ignore error
  }

  return 'chrome'; // Hope it's in the PATH
};

const generateIcons = async () => {
  try {
    if (!fs.existsSync(faviconPath)) {
      console.error(`Favicon not found at ${faviconPath}`);
      return;
    }

    // Read the favicon and extract the paths
    const faviconContent = fs.readFileSync(faviconPath, 'utf8');
    
    // Extract the paths from the SVG
    const svgPathsMatches = [...faviconContent.matchAll(/<path([^>]+)>/g)];
    const svgPaths = svgPathsMatches.map(m => m[0]);

    if (svgPaths.length < 3) {
      console.error('Failed to parse paths from SVG');
      return;
    }

    // Create a new square SVG with solid background and translated center
    const squareSvg = `<?xml version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1500" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#07152E" />
  <g transform="translate(160, 364)">
    ${svgPaths.join('\n    ')}
  </g>
</svg>`;

    const tempSvgPath = path.join(publicDir, 'temp-icon.svg');
    fs.writeFileSync(tempSvgPath, squareSvg);
    console.log('Temporary square SVG created.');

    const chromePath = getChromePath();
    console.log(`Using Chrome at: ${chromePath}`);

    const sizes = [
      { name: 'icon-192.png', size: 192 },
      { name: 'icon-512.png', size: 512 },
      { name: 'icon-180.png', size: 180 }
    ];

    for (const { name, size } of sizes) {
      const outputPath = path.join(publicDir, name);
      console.log(`Generating ${name} (${size}x${size})...`);
      
      const cmd = `"${chromePath}" --headless --disable-gpu --screenshot="${outputPath}" --window-size=${size},${size} "file:///${tempSvgPath.replace(/\\/g, '/')}"`;
      execSync(cmd);
      
      if (fs.existsSync(outputPath)) {
        console.log(`Successfully generated ${name}`);
      } else {
        console.error(`Failed to generate ${name}`);
      }
    }

    // Clean up temporary SVG
    fs.unlinkSync(tempSvgPath);
    console.log('Cleanup completed.');

  } catch (error) {
    console.error('Error generating icons:', error);
  }
};

generateIcons();
