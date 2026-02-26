import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TransactionLog {
  to: string;
  from?: string;
  value: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  riskScore: number;
  blocked: boolean;
  timestamp: string;
  hash?: string;
}

// Function to retrieve transaction logs from localStorage
const getTransactionLogs = (): TransactionLog[] => {
  try {
    const logs = localStorage.getItem('transaction-logs');
    return logs ? JSON.parse(logs) : [];
  } catch (error) {
    console.error('Error retrieving transaction logs:', error);
    return [];
  }
};

// Transaction Logs View component
const TransactionLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  
  useEffect(() => {
    setLogs(getTransactionLogs());
    
    // Refresh logs when new transactions are processed
    const handleNewTransaction = () => {
      setLogs(getTransactionLogs());
    };
    
    window.addEventListener('transaction-logged', handleNewTransaction);
    
    // Storage event for cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'transaction-logs') {
        setLogs(getTransactionLogs());
      }
    };
    window.addEventListener('storage', handleStorage);
    
    return () => {
      window.removeEventListener('transaction-logged', handleNewTransaction);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);
  
  return (
    <Card className="w-full bg-black/30 backdrop-blur-sm border-white/10">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="text-white flex items-center gap-3">
          <span>Transaction Security Log</span>
          <span className="text-sm font-normal text-gray-400">
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {logs.length === 0 ? (
          <div className="text-gray-400 text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-lg font-medium text-gray-300">No transaction logs yet</p>
            <p className="text-sm mt-1">Send a transaction or run the AI Demo to generate security logs.</p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1">
            {logs.map((log, index) => (
              <div 
                key={log.hash || index}
                className={`p-4 rounded-lg transition-colors ${
                  log.blocked 
                    ? 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/15' 
                    : log.riskLevel === 'High'
                      ? 'bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/15'
                      : log.riskLevel === 'Medium'
                        ? 'bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/15'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white font-mono">
                    To: {log.to.substring(0, 6)}...{log.to.substring(log.to.length - 4)}
                  </span>
                  <div className="flex items-center gap-2">
                    {log.blocked && (
                      <span className="text-xs bg-red-500/30 text-red-300 px-2 py-0.5 rounded-full font-medium">
                        BLOCKED
                      </span>
                    )}
                    <span className={`font-medium ${
                      log.riskLevel === 'High' 
                        ? 'text-red-400' 
                        : log.riskLevel === 'Medium' 
                          ? 'text-yellow-400' 
                          : 'text-green-400'
                    }`}>
                      {log.riskLevel} Risk — {log.riskScore.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span className="text-gray-300">{log.value} ETH</span>
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionLogsViewer;
