const levels = ['debug', 'info', 'warn', 'error'];

function shouldLog(configLevel, level) {
  return levels.indexOf(level) >= levels.indexOf(configLevel);
}

export function createLogger(configLevel = 'info') {
  return {
    debug: (msg, meta = {}) => {
      if (shouldLog(configLevel, 'debug')) console.debug(JSON.stringify({ level: 'debug', message: msg, ...meta }));
    },
    info: (msg, meta = {}) => {
      if (shouldLog(configLevel, 'info')) console.log(JSON.stringify({ level: 'info', message: msg, ...meta }));
    },
    warn: (msg, meta = {}) => {
      if (shouldLog(configLevel, 'warn')) console.warn(JSON.stringify({ level: 'warn', message: msg, ...meta }));
    },
    error: (msg, meta = {}) => {
      if (shouldLog(configLevel, 'error')) console.error(JSON.stringify({ level: 'error', message: msg, ...meta }));
    }
  };
}
