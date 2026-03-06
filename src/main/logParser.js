const fs = require('fs');
const { EventEmitter } = require('events');
const chokidar = require('chokidar');

class LogParser extends EventEmitter {
  constructor(clientTxtPath) {
    super();
    this.clientTxtPath = clientTxtPath;
    this.watcher = null;
    this.filePosition = 0;
    this.isRunning = false;
    this.leftoverString = '';

    // Deduplication: track the last zone name emitted so that if both the
    // zoneGenerated and zoneEntered patterns fire for the same transition
    // (which can happen in a single log flush), only one event is sent.
    this._lastZoneEmitted = null;

    // Patterns to match in log file
    this.patterns = {
      // More reliable pattern: area generation
      zoneGenerated: /Generating level \d+ area "([^"]+)" with seed/,
      // Fallback pattern: zone entry message
      zoneEntered: /: You have entered (.+)\./,
      // Level up pattern
      levelUp: /\((\d+)\) has reached level (\d+)/,
    };
  }

  start() {
    if (this.isRunning) {
      return;
    }

    // Validate path
    if (!this.clientTxtPath.toLowerCase().endsWith('.txt')) {
      const err = new Error('Invalid file type: Log file must be a .txt file');
      console.error(err.message);
      this.emit('error', err);
      return;
    }

    // Get current file size to start reading from end
    try {
      const stats = fs.statSync(this.clientTxtPath);
      
      // Basic sanity check on file size (prevent loading something impossibly huge to start)
      // Path of Exile Client.txt can be multiple GBs over years, but we only read the end.
      if (!stats.isFile()) {
        throw new Error('Provided path is not a file');
      }
      
      this.filePosition = Math.max(0, stats.size - 5000); // Start from last 5KB
    } catch (err) {
      console.error('Error reading Client.txt:', err);
      this.emit('error', err);
      return;
    }

    // Watch for file changes
    this.watcher = chokidar.watch(this.clientTxtPath, {
      persistent: true,
      usePolling: true,
      interval: 500,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher.on('change', () => {
      this.readNewLines();
    });

    this.watcher.on('error', (error) => {
      console.error('File watcher error:', error);
      this.emit('error', error);
    });

    this.isRunning = true;
    console.log('Log parser started, watching:', this.clientTxtPath);
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.isRunning = false;
    console.log('Log parser stopped');
  }

  readNewLines() {
    try {
      const stats = fs.statSync(this.clientTxtPath);
      const currentSize = stats.size;

      // File was truncated (e.g., PoE client restart)
      if (currentSize < this.filePosition) {
        console.log('Client.txt was truncated, resetting position');
        this.filePosition = 0;
        return;
      }

      // No new data
      if (currentSize === this.filePosition) {
        return;
      }

      // Sanity check read length to prevent OOM
      const readLength = currentSize - this.filePosition;
      if (readLength > 50 * 1024 * 1024) { // Don't read more than 50MB at once
        console.warn('Excessive new log data detected. Truncating read to prevent memory exhaustion.');
        this.filePosition = currentSize - (50 * 1024 * 1024);
      }

      // Read new data
      const buffer = Buffer.alloc(currentSize - this.filePosition);
      const fd = fs.openSync(this.clientTxtPath, 'r');
      fs.readSync(fd, buffer, 0, buffer.length, this.filePosition);
      fs.closeSync(fd);

      // Update position
      this.filePosition = currentSize;

      // Process new lines with partial line retention for 100% data consistency
      const newContent = this.leftoverString + buffer.toString('utf8');
      const lines = newContent.split('\n');

      // The last element is either an empty string (if ends with newline) or a partial line
      this.leftoverString = lines.pop() || '';

      for (const line of lines) {
        this.parseLine(line);
      }
    } catch (err) {
      console.error('Error reading new lines:', err);
      this.emit('error', err);
    }
  }

  parseLine(line) {
    if (!line.trim()) {
      return;
    }

    // Check for zone generation (most reliable)
    let match = line.match(this.patterns.zoneGenerated);
    if (match) {
      const zoneName = match[1];
      if (zoneName !== this._lastZoneEmitted) {
        this._lastZoneEmitted = zoneName;
        this.emit('zone-entered', zoneName);
      }
      return;
    }

    // Check for zone entry message (fallback)
    match = line.match(this.patterns.zoneEntered);
    if (match) {
      const zoneName = match[1];
      if (zoneName !== this._lastZoneEmitted) {
        this._lastZoneEmitted = zoneName;
        this.emit('zone-entered', zoneName);
      }
      return;
    }

    // Check for level up
    match = line.match(this.patterns.levelUp);
    if (match) {
      const level = parseInt(match[2], 10);
      this.emit('level-up', level);
      return;
    }
  }
}

module.exports = LogParser;
