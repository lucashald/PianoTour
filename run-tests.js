// run-tests.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a timestamp for the filename
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '_');
const outputFileName = `test-output-${timestamp}.txt`;
const outputFilePath = path.join(__dirname, 'test-logs', outputFileName); // Save logs in a 'test-logs' directory

// Ensure the test-logs directory exists
const logDir = path.join(__dirname, 'test-logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Command to run Jest with verbose output
// --clearCache is added to ensure Babel cache is fresh, useful for debugging config issues
const jestCommand = 'npx jest --verbose --debug --runInBand'; // Using 'npx jest' to ensure correct Jest binary

console.log(`Running tests... Output will be saved to: ${outputFilePath}`);

// Execute the Jest command
const child = exec(jestCommand);

let outputBuffer = '';

// Capture stdout and stderr
child.stdout.on('data', (data) => {
    process.stdout.write(data); // Also print to console so you see real-time progress
    outputBuffer += data;
});

child.stderr.on('data', (data) => {
    process.stderr.write(data); // Also print to console
    outputBuffer += data;
});

// When the command finishes
child.on('close', (code) => {
    console.log(`\nTests finished with exit code: ${code}`);
    fs.writeFileSync(outputFilePath, outputBuffer); // Write full output to file
    console.log(`Full test log saved to: ${outputFilePath}`);

    if (code !== 0) {
        console.error('Tests failed. Check the log file for details.');
        process.exit(1); // Exit with non-zero code if tests failed
    } else {
        console.log('All tests passed!');
    }
});

child.on('error', (err) => {
    console.error(`Failed to start child process: ${err.message}`);
    fs.writeFileSync(outputFilePath, `Error starting test process: ${err.message}\n${outputBuffer}`);
    process.exit(1);
});