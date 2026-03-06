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

    // Prevent duplicate zone events
    this._lastZoneEmitted = null;

    // Regex patterns
    this.patterns = {
      // Area generation
      zoneGenerated: /Generating level \d+ area "([^"]+)" with seed/,
      // Zone entry
      zoneEntered: /: You have entered (.+)\./,
      // Level up
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

    // Get file size
    try {
      const stats = fs.statSync(this.clientTxtPath);
      
      // Read tail only
      if (!stats.isFile()) {
        throw new Error('Provided path is not a file');
      }
      
      this.filePosition = Math.max(0, stats.size - 5000); // Start from last 5KB
    } catch (err) {
      console.error('Error reading Client.txt:', err);
      this.emit('error', err);
      return;
    }

    // Watch file
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

      // File truncated
      if (currentSize < this.filePosition) {
        console.log('Client.txt was truncated, resetting position');
        this.filePosition = 0;
        return;
      }

      // No new data
      if (currentSize === this.filePosition) {
        return;
      }

      // OOM protection
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

      // Process lines
      const newContent = this.leftoverString + buffer.toString('utf8');
      const lines = newContent.split('\n');

      // Store partial line
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

    // Zone generation
    let match = line.match(this.patterns.zoneGenerated);
    if (match) {
      const zoneName = match[1];
      if (zoneName !== this._lastZoneEmitted) {
        this._lastZoneEmitted = zoneName;
        this.emit('zone-entered', zoneName);
      }
      return;
    }

    // Zone entry
    match = line.match(this.patterns.zoneEntered);
    if (match) {
      const zoneName = match[1];
      if (zoneName !== this._lastZoneEmitted) {
        this._lastZoneEmitted = zoneName;
        this.emit('zone-entered', zoneName);
      }
      return;
    }

    // Level up
    match = line.match(this.patterns.levelUp);
    if (match) {
      const level = parseInt(match[2], 10);
      this.emit('level-up', level);
      return;
    }
  }
}

module.exports = LogParser;
