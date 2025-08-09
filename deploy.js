const { execSync } = require('child_process');
const commands = `
curl -L https://fly.io/install.sh | sh && \
export FLYCTL_INSTALL="/home/codespace/.fly" && \
export PATH="$FLYCTL_INSTALL/bin:$PATH" && \
fly deploy
`;

console.log("Starting Fly.io deployment script via Node.js...");

try {
  execSync(commands, { stdio: 'inherit' });
  console.log("Deployment completed successfully!");
} catch (error) {
  console.error("An error occurred during the deployment:");
  console.error(error.message);
  process.exit(1); // Exit with a non-zero code to indicate failure.
}
