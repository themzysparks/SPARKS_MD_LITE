# SPARKS_MD_LITE

<p align="center">
  <img src="https://raw.githubusercontent.com/themzysparks/SPARKS_MD/main/sparks.jpg" alt="SPARKS_MD_LITE Banner" width="300"/>
</p>

**SPARKS_MD_LITE** is a lightweight and efficient WhatsApp bot developed by **SPARKS**. This bot focuses on automating the tagging process within WhatsApp groups, helping users to easily manage tags without the hassle of manual tagging. It’s a sub-bot of the more feature-rich **SPARKS_MD**, providing essential functionality for groups that need efficient automation.

---

## Project Details

- **Project Name**: SPARKS_MD_LITE
- **Author**: SPARKS
- **Version**: 1.0
- **License**: GPL-3.0 License
- **Created By**: SPARKS
- **© 2025 SPARKS TECH SOLUTIONS**

---

## Features

- **Auto-tagging**: Automatically tag users based on commands or specific conditions.
- **Lightweight**: Designed for minimal resource usage while delivering high efficiency.
- **Fast Execution**: Quickly processes messages and tags users with no delays.
- **Easy Setup**: Simple configuration and setup to get started in no time.

---

## How to Deploy on Panel

To deploy **SPARKS_MD_LITE** on your panel, follow these steps:

1. **[`FORK REPO`](https://github.com/themzysparks/SPARKS_MD_LITE/fork)**
2. **Click [`HERE`](https://sparksmd.duckdns.org/pair) To get your `SESSION_ID`.**
3. **Click New File** on your panel interface.
4. **Name the file** `index.js` (as in the panel startup script).
5. **Paste the code below** into the file and **change all the variable names** accordingly (like `BOT_NUMBER`, `SESSION_ID`, etc.).
6. **Save File and start Server✔️💖👍**

```javascript
const { spawnSync, spawn } = require('child_process');
const { existsSync, writeFileSync } = require('fs');
const path = require('path');

// Define your configuration variables
const BOT_NUMBER = '2349130815781'; // Example value
const SESSION_ID = 'session ID here'; // Example value
const PREFIX = '#'; // Example value
const DOWNLOAD_LIMIT = 10; // Example value

const sparksMdLiteDir = 'sparks_md_lite';

// Retry logic variables
let nodeRestartCount = 0;
const maxNodeRestarts = 5;
const restartWindow = 30000; // 30 seconds
let lastRestartTime = Date.now();

// Function to run a command with fallback between yarn and npm
function runCommandWithFallback(command, args, cwd) {
  let result = spawnSync(command, args, { cwd, stdio: 'inherit' });

  if (result.error || result.status !== 0) {
    console.error(`${command} failed, trying npm...`);
    // Fallback to npm if Yarn fails
    const fallbackCommand = command === 'yarn' ? 'npm' : 'yarn';
    result = spawnSync(fallbackCommand, args, { cwd, stdio: 'inherit' });
  }

  if (result.error || result.status !== 0) {
    console.error(`${command} and npm both failed. Exiting...`);
    process.exit(1);
  }
}

// Function to start the Node.js app
function startNode() {
  const child = spawn('node', ['index.js'], { cwd: sparksMdLiteDir, stdio: 'inherit' });

  child.on('exit', (code) => {
    if (code !== 0) {
      const currentTime = Date.now();
      if (currentTime - lastRestartTime > restartWindow) {
        nodeRestartCount = 0;
      }
      lastRestartTime = currentTime;
      nodeRestartCount++;

      if (nodeRestartCount > maxNodeRestarts) {
        console.error('Node.js process is restarting continuously. Stopping retries...');
        return;
      }
      console.log(`Node.js process exited with code ${code}. Restarting... (Attempt ${nodeRestartCount})`);
      startNode();
    }
  });
}

// Function to start PM2
function startPm2() {
  const pm2 = spawn('yarn', ['pm2', 'start', 'index.js', '--name', 'sparks_md_lite', '--attach'], {
    cwd: sparksMdLiteDir,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let restartCount = 0;
  const maxRestarts = 5;

  pm2.on('exit', (code) => {
    if (code !== 0) {
      console.log('yarn pm2 failed to start, falling back to node...');
      startNode();
    }
  });

  pm2.on('error', (error) => {
    console.error(`yarn pm2 error: ${error.message}`);
    startNode();
  });

  // Check for infinite restarts
  if (pm2.stderr) {
    pm2.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('restart')) {
        restartCount++;
        if (restartCount > maxRestarts) {
          console.log('yarn pm2 is restarting indefinitely, stopping yarn pm2 and starting node...');
          spawnSync('yarn', ['pm2', 'delete', 'sparks_md_lite'], { cwd: sparksMdLiteDir, stdio: 'inherit' });
          startNode();
        }
      }
    });
  }

  if (pm2.stdout) {
    pm2.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      if (output.includes('online')) {
        restartCount = 0;
      }
    });
  }
}

// Function to install dependencies using yarn or npm
function installDependencies() {
  console.log('Installing dependencies...');
  runCommandWithFallback('yarn', ['install'], sparksMdLiteDir);
}

// Function to install PM2 globally using yarn or npm
function installPm2() {
  runCommandWithFallback('yarn', ['global', 'add', 'pm2'], null);
}

// Function to clone the repository
function cloneRepository() {
  console.log('Cloning the repository...');
  const cloneResult = spawnSync('git', ['clone', 'https://github.com/themzysparks/SPARKS_MD_LITE.git', sparksMdLiteDir], {
    stdio: 'inherit',
  });

  if (cloneResult.error) {
    throw new Error(`Failed to clone the repository: ${cloneResult.error.message}`);
  }

  const envFilePath = path.join(sparksMdLiteDir, '.env');
  try {
    console.log('Writing to .env...');
    writeFileSync(envFilePath, `BOT_NUMBER=${BOT_NUMBER}\nSESSION_ID=${SESSION_ID}\nPREFIX=${PREFIX}\nDOWNLOAD_LIMIT=${DOWNLOAD_LIMIT}`);
  } catch (err) {
    throw new Error(`Failed to write to .env: ${err.message}`);
  }

  installDependencies();
}

// Check if the directory exists
if (!existsSync(sparksMdLiteDir)) {
  cloneRepository();
} else {
  installDependencies();
}

// Install PM2 if not already installed globally
installPm2();

// Start the app with PM2
startPm2();
```

---

## Social Media

Stay connected and follow SPARKS for more updates, tutorials, and exclusive content:

### YouTube
[![Cyber with Sparks](https://img.shields.io/badge/YouTube-Subscribe-red?style=for-the-badge&logo=youtube)](https://youtube.com/@cyberwithsparks)

### Instagram
[![Follow on Instagram](https://img.shields.io/badge/Instagram-Follow-purple?style=for-the-badge&logo=instagram)](https://www.instagram.com/sparksthemzy)

### Donate
[![Donate to SPARKS](https://img.shields.io/badge/Donate-Support-green?style=for-the-badge&logo=paypal)](https://paystack.com/pay/sparks_md_donation)

---

## Contributing

If you'd like to contribute to **SPARKS_MD_LITE**, feel free to fork the repository and create a pull request. Contributions are always welcome!

---

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.
