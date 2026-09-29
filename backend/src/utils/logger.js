const writeLog = (level, message, meta = {}) => {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };

  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
};

const logger = {
  info: (message, meta) => writeLog('info', message, meta),
  warn: (message, meta) => writeLog('warn', message, meta),
  error: (message, meta) => writeLog('error', message, meta)
};

export default logger;
