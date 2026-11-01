// Tactical Mission & Ballistics Logging Utility

const LOG_MAX_ENTRIES = 150;
const logHistory = [];
const subscribers = new Set();

export const LogLevel = {
  INFO: 'INFO',
  TACTICAL: 'TACTICAL',
  WARN: 'WARN',
  ERROR: 'ERROR',
  TEST: 'TEST',
};

function dispatchLog(level, category, message, data = null) {
  const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp,
    level,
    category,
    message,
    data,
  };

  logHistory.push(entry);
  if (logHistory.length > LOG_MAX_ENTRIES) {
    logHistory.shift();
  }

  // Styled console output for military C2 debugging
  const badgeStyle = {
    [LogLevel.INFO]: 'background: #1e293b; color: #94a3b8; font-weight: bold; border-radius: 3px; padding: 2px 5px;',
    [LogLevel.TACTICAL]: 'background: #003844; color: #00f0ff; font-weight: bold; border-radius: 3px; padding: 2px 5px;',
    [LogLevel.WARN]: 'background: #451a03; color: #f59e0b; font-weight: bold; border-radius: 3px; padding: 2px 5px;',
    [LogLevel.ERROR]: 'background: #450a0a; color: #ef4444; font-weight: bold; border-radius: 3px; padding: 2px 5px;',
    [LogLevel.TEST]: 'background: #064e3b; color: #10b981; font-weight: bold; border-radius: 3px; padding: 2px 5px;',
  }[level] || 'background: #333; color: #fff;';

  console.log(
    `%c[BALLISTICA-C2 %c${level}%c %c${category}%c] ${message}`,
    'color: #38bdf8; font-weight: 700;',
    badgeStyle,
    'color: inherit;',
    'color: #f1f5f9; font-weight: 600;',
    'color: #94a3b8;',
    data || ''
  );

  subscribers.forEach(cb => {
    try { cb(entry); } catch { /* ignore subscriber error */ }
  });

  return entry;
}

export const logger = {
  info: (category, message, data) => dispatchLog(LogLevel.INFO, category, message, data),
  tactical: (category, message, data) => dispatchLog(LogLevel.TACTICAL, category, message, data),
  warn: (category, message, data) => dispatchLog(LogLevel.WARN, category, message, data),
  error: (category, message, data) => dispatchLog(LogLevel.ERROR, category, message, data),
  test: (category, message, data) => dispatchLog(LogLevel.TEST, category, message, data),
  getHistory: () => [...logHistory],
  subscribe: (callback) => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },
  clear: () => {
    logHistory.length = 0;
    subscribers.forEach(cb => { try { cb({ type: 'CLEAR' }); } catch { /* ignore subscriber error */ } });
  }
};
