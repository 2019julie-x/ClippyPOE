const fs = require('fs');
const path = require('path');
const os = require('os');
const LogParser = require('../../src/main/logParser');

function writeTempFile(content = '') {
  const tmpPath = path.join(os.tmpdir(), `poe-test-${Date.now()}-${Math.random()}.txt`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  return tmpPath;
}

function appendToFile(filePath, content) {
  fs.appendFileSync(filePath, content, 'utf8');
}

describe('LogParser – parseLine()', () => {
  let parser;

  beforeEach(() => {
    parser = new LogParser('/fake/Client.txt');
  });

  test('emits zone-entered with area level for zoneGenerated pattern', (done) => {
    parser.once('zone-entered', (name, areaLevel) => {
      expect(name).toBe('Lioneye\'s Watch');
      expect(areaLevel).toBe(1);
      done();
    });
    parser.parseLine('2024/01/01 00:00:00 Generating level 1 area "Lioneye\'s Watch" with seed 12345');
  });

  test('emits zone-entered with null area level for zoneEntered pattern', (done) => {
    parser.once('zone-entered', (name, areaLevel) => {
      expect(name).toBe('The Twilight Strand');
      expect(areaLevel).toBeNull();
      done();
    });
    parser.parseLine('2024/01/01 00:00:00 : You have entered The Twilight Strand.');
  });

  test('prefers zoneGenerated over zoneEntered when both match', (done) => {
    const events = [];
    parser.on('zone-entered', (name, areaLevel) => events.push({ name, areaLevel }));
    parser.parseLine('2024/01/01 Generating level 5 area "The Ledge" with seed 99');
    setImmediate(() => {
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('The Ledge');
      expect(events[0].areaLevel).toBe(5);
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

  test('parses area level correctly for high-level zones', (done) => {
    parser.once('zone-entered', (name, areaLevel) => {
      expect(name).toBe('The Sarn Encampment');
      expect(areaLevel).toBe(55);
      done();
    });
    parser.parseLine('2024/01/01 Generating level 55 area "The Sarn Encampment" with seed 999');
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
    parser.start();
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
    const bigContent = 'x'.repeat(10000) + '\n';
    tmpPath = writeTempFile(bigContent);
    const parser = new LogParser(tmpPath);
    parser.start();
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



describe('LogParser – readNewLines()', () => {
  let tmpPath;

  afterEach(() => {
    if (tmpPath && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  });

  test('resets filePosition to 0 when file is truncated', () => {
    tmpPath = writeTempFile('A'.repeat(6000) + '\n');
    const parser = new LogParser(tmpPath);
    parser.start();
    expect(parser.filePosition).toBeGreaterThan(0);
    fs.writeFileSync(tmpPath, 'x\n', 'utf8');
    parser.readNewLines();
    expect(parser.filePosition).toBe(0);
    parser.stop();
  });

  test('handles partial lines correctly across two reads', (done) => {
    tmpPath = writeTempFile('');
    const parser = new LogParser(tmpPath);
    parser.start();

    const events = [];
    parser.on('zone-entered', (name) => events.push(name));

    appendToFile(tmpPath, '2024/01/01 Generating level 1 area "The Coast"');
    parser.readNewLines();

    expect(events).toHaveLength(0);

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
    parser.filePosition = fs.statSync(tmpPath).size;
    const pos = parser.filePosition;
    parser.readNewLines();
    expect(parser.filePosition).toBe(pos);
    parser.stop();
  });
});



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
