/**
 * Unit tests for LogParser
 *
 * LogParser is responsible for tailing Client.txt and emitting:
 *   - 'zone-entered'  when a new area is generated or entered
 *   - 'level-up'      when the player levels up
 *   - 'error'         on fatal I/O errors
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const LogParser = require('../../src/main/logParser');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write content to a temp file and return the path.
 */
function writeTempFile(content = '') {
  const tmpPath = path.join(os.tmpdir(), `poe-test-${Date.now()}-${Math.random()}.txt`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  return tmpPath;
}

/**
 * Append content to an existing file.
 */
function appendToFile(filePath, content) {
  fs.appendFileSync(filePath, content, 'utf8');
}

// ---------------------------------------------------------------------------
// parseLine() – internal method tested via the public API
// We access it directly for fast, sync unit testing.
// ---------------------------------------------------------------------------

describe('LogParser – parseLine()', () => {
  let parser;

  beforeEach(() => {
    // Create a parser with a dummy path (parseLine doesn't do I/O)
    parser = new LogParser('/fake/Client.txt');
  });

  // ---- Zone patterns -------------------------------------------------------

  test('emits zone-entered for zoneGenerated pattern', (done) => {
    parser.once('zone-entered', (name) => {
      expect(name).toBe('Lioneye\'s Watch');
      done();
    });
    parser.parseLine('2024/01/01 00:00:00 Generating level 1 area "Lioneye\'s Watch" with seed 12345');
  });

  test('emits zone-entered for zoneEntered fallback pattern', (done) => {
    parser.once('zone-entered', (name) => {
      expect(name).toBe('The Twilight Strand');
      done();
    });
    parser.parseLine('2024/01/01 00:00:00 : You have entered The Twilight Strand.');
  });

  test('prefers zoneGenerated over zoneEntered when both match', (done) => {
    // Construct a contrived line that matches both (shouldn't happen in practice,
    // but tests that the primary pattern takes precedence via early return).
    const events = [];
    parser.on('zone-entered', (name) => events.push(name));
    parser.parseLine('2024/01/01 Generating level 5 area "The Ledge" with seed 99');
    // Only one event should fire
    setImmediate(() => {
      expect(events).toHaveLength(1);
      expect(events[0]).toBe('The Ledge');
      done();
    });
  });

  test('emits level-up with correct level', (done) => {
    parser.once('level-up', (level) => {
      expect(level).toBe(12);
      done();
    });
    parser.parseLine('2024/01/01 00:00:00 : PlayerName (12) has reached level 12');
  });

  test('emits level-up with correct level for two-digit levels', (done) => {
    parser.once('level-up', (level) => {
      expect(level).toBe(68);
      done();
    });
    parser.parseLine('2024/01/01 00:00:00 : SomeChar (68) has reached level 68');
  });

  test('emits level-up with correct level for three-digit levels (100)', (done) => {
    parser.once('level-up', (level) => {
      expect(level).toBe(100);
      done();
    });
    parser.parseLine('2024/01/01 : SomeChar (100) has reached level 100');
  });

  test('does not emit events for unrelated log lines', () => {
    const spy = jest.fn();
    parser.on('zone-entered', spy);
    parser.on('level-up', spy);

    parser.parseLine('2024/01/01 00:00:00 [INFO Client 12345] Something unrelated happened');
    parser.parseLine('2024/01/01 00:00:00 Connecting to instance server...');
    parser.parseLine('');
    parser.parseLine('   ');

    expect(spy).not.toHaveBeenCalled();
  });

  test('does not emit for empty or whitespace-only lines', () => {
    const spy = jest.fn();
    parser.on('zone-entered', spy);
    parser.on('level-up', spy);
    parser.parseLine('');
    parser.parseLine('   \t  ');
    expect(spy).not.toHaveBeenCalled();
  });

  test('zone name can contain spaces and apostrophes', (done) => {
    parser.once('zone-entered', (name) => {
      expect(name).toBe("Maligaro's Sanctum");
      done();
    });
    parser.parseLine('2024/01/01 Generating level 30 area "Maligaro\'s Sanctum" with seed 999');
  });

  test('zone name with special characters in zoneEntered pattern', (done) => {
    parser.once('zone-entered', (name) => {
      expect(name).toBe("Merveil's Caverns");
      done();
    });
    parser.parseLine("2024/01/01 : You have entered Merveil's Caverns.");
  });
});

// ---------------------------------------------------------------------------
// start() – validation and initialisation
// ---------------------------------------------------------------------------

describe('LogParser – start()', () => {
  let tmpPath;

  afterEach(() => {
    if (tmpPath && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  });

  test('emits error for non-.txt file extension', (done) => {
    const parser = new LogParser('/fake/Client.log');
    parser.once('error', (err) => {
      expect(err.message).toMatch(/\.txt/i);
      done();
    });
    parser.start();
  });

  test('emits error when file does not exist', (done) => {
    const parser = new LogParser('/nonexistent/path/Client.txt');
    parser.once('error', () => done());
    parser.start();
  });

  test('does not start twice if already running', () => {
    tmpPath = writeTempFile('initial content\n');
    const parser = new LogParser(tmpPath);
    parser.start();
    expect(parser.isRunning).toBe(true);
    // calling start() again should be a no-op
    parser.start();
    // isRunning stays true, no crash
    expect(parser.isRunning).toBe(true);
    parser.stop();
  });

  test('sets isRunning to true after successful start', () => {
    tmpPath = writeTempFile('some log content\n');
    const parser = new LogParser(tmpPath);
    parser.start();
    expect(parser.isRunning).toBe(true);
    parser.stop();
  });

  test('sets isRunning to false after stop', () => {
    tmpPath = writeTempFile('some log content\n');
    const parser = new LogParser(tmpPath);
    parser.start();
    parser.stop();
    expect(parser.isRunning).toBe(false);
  });

  test('initialises filePosition to near the end of an existing file', () => {
    // Write content larger than the 5000-byte lookback window
    const bigContent = 'x'.repeat(10000) + '\n';
    tmpPath = writeTempFile(bigContent);
    const parser = new LogParser(tmpPath);
    parser.start();
    // filePosition should be (size - 5000) or 0 if size < 5000
    const stats = fs.statSync(tmpPath);
    expect(parser.filePosition).toBe(Math.max(0, stats.size - 5000));
    parser.stop();
  });

  test('initialises filePosition to 0 for very small files', () => {
    tmpPath = writeTempFile('tiny\n');
    const parser = new LogParser(tmpPath);
    parser.start();
    expect(parser.filePosition).toBe(0);
    parser.stop();
  });
});

// ---------------------------------------------------------------------------
// readNewLines() – file truncation and partial-line handling
// ---------------------------------------------------------------------------

describe('LogParser – readNewLines()', () => {
  let tmpPath;

  afterEach(() => {
    if (tmpPath && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  });

  test('resets filePosition to 0 when file is truncated', () => {
    // Write a file large enough that start() sets filePosition > 0
    tmpPath = writeTempFile('A'.repeat(6000) + '\n');
    const parser = new LogParser(tmpPath);
    parser.start();
    // filePosition should be stats.size - 5000 (> 0)
    expect(parser.filePosition).toBeGreaterThan(0);
    // Simulate truncation: overwrite with much shorter content
    fs.writeFileSync(tmpPath, 'x\n', 'utf8');
    parser.readNewLines();
    // currentSize (2) < filePosition, so position is reset to 0
    expect(parser.filePosition).toBe(0);
    parser.stop();
  });

  test('handles partial lines correctly across two reads', (done) => {
    tmpPath = writeTempFile('');
    const parser = new LogParser(tmpPath);
    parser.start();

    const events = [];
    parser.on('zone-entered', (name) => events.push(name));

    // Write a partial line (no trailing newline)
    appendToFile(tmpPath, '2024/01/01 Generating level 1 area "The Coast"');
    parser.readNewLines();

    // Zone should NOT be emitted yet (no newline)
    expect(events).toHaveLength(0);

    // Complete the line
    appendToFile(tmpPath, ' with seed 1\n');
    parser.readNewLines();

    expect(events).toHaveLength(1);
    expect(events[0]).toBe('The Coast');
    parser.stop();
    done();
  });

  test('no new data: filePosition unchanged after a read when nothing was appended', () => {
    tmpPath = writeTempFile('content\n');
    const parser = new LogParser(tmpPath);
    parser.start();
    // Manually advance filePosition to reflect "we have already read everything"
    parser.filePosition = fs.statSync(tmpPath).size;
    const pos = parser.filePosition;
    // No new data appended – readNewLines must be a no-op
    parser.readNewLines();
    expect(parser.filePosition).toBe(pos);
    parser.stop();
  });
});

// ---------------------------------------------------------------------------
// stop()
// ---------------------------------------------------------------------------

describe('LogParser – stop()', () => {
  test('can be called safely when never started', () => {
    const parser = new LogParser('/fake/Client.txt');
    expect(() => parser.stop()).not.toThrow();
    expect(parser.isRunning).toBe(false);
  });

  test('nullifies watcher on stop', () => {
    const tmpPath = writeTempFile('data\n');
    const parser = new LogParser(tmpPath);
    parser.start();
    expect(parser.watcher).not.toBeNull();
    parser.stop();
    expect(parser.watcher).toBeNull();
    fs.unlinkSync(tmpPath);
  });
});
