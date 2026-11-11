import { FC, useState, useEffect, useCallback } from 'react';
import { auditApi, extractErrorMessage } from '../api/client.js';
import { AuditLog, AuditVerifyResult } from '../types/index.js';
import { formatDateTime } from '../utils/currency.js';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  FileCode,
  X,
  Fingerprint,
} from 'lucide-react';

export const AuditPage: FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Verification state
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  // Table loading and error
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded details modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Copied hash indicator
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Run cryptographic verification
  const handleVerifyChain = async () => {
    try {
      setIsVerifying(true);
      setError(null);
      const res = await auditApi.verifyChain();
      setVerifyResult(res);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsVerifying(false);
    }
  };

  // Fetch paginated logs
  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params: {
        page: number;
        limit: number;
        action?: string;
        resource?: string;
      } = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (actionFilter.trim()) params.action = actionFilter.trim();
      if (resourceFilter.trim()) params.resource = resourceFilter.trim();

      const res = await auditApi.listLogs(params);
      setLogs(res.logs);
      setPagination(res.pagination);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, actionFilter, resourceFilter]);

  // Initial load
  useEffect(() => {
    fetchLogs();
    handleVerifyChain();
  }, [fetchLogs]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Fingerprint className="w-6 h-6 text-emerald-400" />
            Cryptographic Audit Trail
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            SHA-256 tamper-evident append-only hash chain with mathematical proof of ledger integrity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Logs
          </button>

          <button
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            <ShieldCheck className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            {isVerifying ? 'Verifying Hashes...' : 'Verify Ledger Integrity'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Cryptographic Chain Verification Badge Card */}
      {verifyResult && (
        <div
          className={`rounded-3xl p-6 sm:p-7 border shadow-2xl transition-all ${
            verifyResult.isValid
              ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-950/20'
              : 'bg-rose-950/40 border-rose-500 shadow-rose-950/40 animate-pulse'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  verifyResult.isValid
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {verifyResult.isValid ? (
                  <ShieldCheck className="w-7 h-7" />
                ) : (
                  <ShieldAlert className="w-7 h-7" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                      verifyResult.isValid
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500'
                    }`}
                  >
                    {verifyResult.status}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Genesis: 0000000000000000...
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mt-1">
                  {verifyResult.isValid
                    ? 'Cryptographic Audit Hash Chain Intact'
                    : 'Hash Chain Integrity Violation Detected!'}
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {verifyResult.message}
                </p>

                {!verifyResult.isValid && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-950 border border-rose-800 text-xs font-mono text-rose-200 space-y-1">
                    <p>
                      <strong>Broken at Sequence:</strong> #{verifyResult.brokenAtSequence}
                    </p>
                    <p>
                      <strong>Diagnostic Reason:</strong> {verifyResult.reason}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center min-w-[160px] self-start sm:self-auto">
              <span className="text-[11px] font-mono text-slate-400 uppercase block">Verified Blocks</span>
              <span className="text-3xl font-extrabold text-white font-mono mt-0.5 block">
                {verifyResult.totalEntries}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium">Chained SHA-256 Hashes</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Logs:</span>
          </div>

          <input
            type="text"
            placeholder="Action (e.g. TRANSFER, DEPOSIT)"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
          />

          <input
            type="text"
            placeholder="Resource (e.g. Account, Transaction)"
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono self-end sm:self-auto">
          Total Recorded Events: <strong className="text-white">{pagination.total}</strong>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Seq #</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Resource</th>
                <th className="py-3.5 px-4">SHA-256 Hash</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
                    Fetching cryptographic audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No audit logs recorded matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const hashToDisplay = log.currentHash || log.hash || '';
                  const shortHash = hashToDisplay.slice(0, 10) + '...' + hashToDisplay.slice(-6);

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Sequence # */}
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap font-bold text-emerald-400">
                        #{log.sequenceNumber}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-sans">
                        {formatDateTime(log.timestamp)}
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-slate-200">
                          {log.actorRole || 'SYSTEM'}
                        </span>
                        {log.actorId && (
                          <span className="text-[10px] text-slate-500 block truncate max-w-[120px]">
                            {log.actorId}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-bold text-[11px] text-white">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              log.status === 'SUCCESS' ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {log.action}
                        </span>
                      </td>

                      {/* Resource */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                        <span>{log.resource}</span>
                        {log.resourceId && (
                          <span className="text-[10px] text-slate-500 block truncate max-w-[120px]">
                            {log.resourceId}
                          </span>
                        )}
                      </td>

                      {/* Current SHA-256 Hash Preview */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-teal-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {shortHash}
                          </span>
                          <button
                            onClick={() => copyToClipboard(hashToDisplay, log.id)}
                            title="Copy full SHA-256 hash"
                            className="p-1 rounded text-slate-500 hover:text-white transition-colors"
                          >
                            {copiedHash === log.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Details View Button */}
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-right font-sans">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                        >
                          <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-sans">
            <div>
              Showing page <strong className="text-white">{pagination.page}</strong> of{' '}
              <strong className="text-white">{pagination.totalPages}</strong> ({pagination.total} total logs)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1 || isLoading}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(pagination.totalPages, prev.page + 1),
                  }))
                }
                disabled={pagination.page >= pagination.totalPages || isLoading}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">
                  Audit Block #{selectedLog.sequenceNumber} Details
                </h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Action</span>
                  <span className="text-white font-bold">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Status</span>
                  <span className="text-emerald-400 font-bold">{selectedLog.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Timestamp</span>
                  <span className="text-slate-300 font-sans">{formatDateTime(selectedLog.timestamp)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Actor ID</span>
                  <span className="text-slate-300 break-all">{selectedLog.actorId || 'SYSTEM'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-slate-400 block text-[11px] mb-1 font-sans">Previous Hash (Link)</span>
                  <p className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-teal-300 break-all text-[11px]">
                    {selectedLog.previousHash}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] mb-1 font-sans">Current Hash (SHA-256)</span>
                  <p className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 break-all text-[11px]">
                    {selectedLog.currentHash || selectedLog.hash}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-1 font-sans">Event Details (JSON Payload)</span>
                <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2) || '{}'}
                </pre>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
