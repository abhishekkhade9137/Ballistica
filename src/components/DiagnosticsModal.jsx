import React, { useState, useEffect, useCallback } from 'react';
import styles from './DiagnosticsModal.module.css';
import { runClientDiagnostics } from '../utils/selfTestRunner';
import { logger } from '../utils/logger';

function DiagnosticsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'logs'
  const [testReport, setTestReport] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Initial fetch of logs
    setLogs(logger.getHistory());

    // Subscribe to new incoming logs
    const unsubscribe = logger.subscribe((entry) => {
      if (entry.type === 'CLEAR') {
        setLogs([]);
      } else {
        setLogs(logger.getHistory());
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRunTests = useCallback(async () => {
    setIsRunning(true);
    try {
      const report = await runClientDiagnostics();
      setTestReport(report);
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    } finally {
      setIsRunning(false);
    }
  }, []);

  // Run initial test on open if not run yet
  useEffect(() => {
    if (isOpen && !testReport && !isRunning) {
      handleRunTests();
    }
  }, [isOpen, testReport, isRunning, handleRunTests]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div>
              <h3>BALLISTICA C2 — SYSTEM DIAGNOSTICS &amp; TELEMETRY LOGS</h3>
              <p>Automated Ballistic Test Verification &amp; Real-Time Operational Audit Trail</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Navigation Tabs */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'tests' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('tests')}
          >
            <span>Ballistic Test Suite</span>
            {testReport && (
              <span className={styles.countBadge}>
                {testReport.passCount}/{testReport.totalCount} PASS
              </span>
            )}
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'logs' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <span>Mission Telemetry Logs</span>
            <span className={styles.logCountBadge}>{logs.length}</span>
          </button>
        </div>

        {/* Tab 1: Ballistic Test Suite */}
        {activeTab === 'tests' && (
          <div className={styles.tabContent}>
            <div className={styles.actionRow}>
              <div>
                <span className={styles.cliHint}>
                  Terminal Command: <code className={styles.codeSnippet}>npm test</code>
                </span>
              </div>
              <button
                type="button"
                className={styles.runBtn}
                onClick={handleRunTests}
                disabled={isRunning}
              >
                {isRunning ? '⏳ Running Diagnostics...' : '▶ Re-Run All Diagnostics'}
              </button>
            </div>

            {testReport ? (
              <>
                <div className={styles.summaryCards}>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Overall Status</span>
                    <span className={`${styles.summaryValue} ${testReport.failCount === 0 ? styles.passText : styles.failText}`}>
                      {testReport.failCount === 0 ? 'ALL TESTS PASSED' : `${testReport.failCount} FAILURES`}
                    </span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Tests Executed</span>
                    <span className={styles.summaryValue}>{testReport.totalCount} Assertions</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Execution Latency</span>
                    <span className={styles.summaryValue}>{testReport.totalTimeMs} ms</span>
                  </div>
                </div>

                <div className={styles.testList}>
                  {testReport.results.map((t, idx) => (
                    <div key={idx} className={`${styles.testRow} ${t.status === 'PASS' ? styles.passRow : styles.failRow}`}>
                      <div className={styles.testInfo}>
                        <span className={styles.testSuiteBadge}>{t.suite}</span>
                        <span className={styles.testName}>{t.name}</span>
                        {t.error && <div className={styles.testError}>{t.error}</div>}
                      </div>
                      <div className={styles.testMeta}>
                        <span className={styles.testDuration}>{t.durationMs}ms</span>
                        <span className={`${styles.statusBadge} ${t.status === 'PASS' ? styles.statusPass : styles.statusFail}`}>
                          {t.status === 'PASS' ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.loadingBox}>
                <span>Initializing automated verification suite...</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Mission Telemetry Logs */}
        {activeTab === 'logs' && (
          <div className={styles.tabContent}>
            <div className={styles.actionRow}>
              <span className={styles.cliHint}>
                Auto-capturing WGS-84 coordinate clicks, elevation lookups, and solver convergence.
              </span>
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => logger.clear()}
              >
                Clear Log Buffer
              </button>
            </div>

            <div className={styles.logConsole}>
              {logs.length === 0 ? (
                <div className={styles.emptyLogs}>No mission events recorded yet. Click map or compute trajectories.</div>
              ) : (
                logs.map((entry) => (
                  <div key={entry.id} className={styles.logLine}>
                    <span className={styles.logTime}>[{entry.timestamp}]</span>
                    <span className={`${styles.logLevel} ${styles[entry.level.toLowerCase()]}`}>
                      {entry.level}
                    </span>
                    <span className={styles.logCategory}>{entry.category}</span>
                    <span className={styles.logMsg}>{entry.message}</span>
                    {entry.data && (
                      <span className={styles.logData}>
                        {typeof entry.data === 'object' ? JSON.stringify(entry.data) : entry.data}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DiagnosticsModal;
