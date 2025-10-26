'use client';

import { useState } from 'react';

export default function Home() {
  const [repoLink, setRepoLink] = useState('');
  const [issueLink, setIssueLink] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-5-nano');
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [repoName, setRepoName] = useState<string>('');
  const [statusLogs, setStatusLogs] = useState<string[]>([]);

  // Complexity-specific budget ranges
  const [lowMin, setLowMin] = useState('');
  const [lowMax, setLowMax] = useState('');
  const [mediumMin, setMediumMin] = useState('');
  const [mediumMax, setMediumMax] = useState('');
  const [highMin, setHighMin] = useState('');
  const [highMax, setHighMax] = useState('');
  const [criticalMin, setCriticalMin] = useState('');
  const [criticalMax, setCriticalMax] = useState('');

  // Accordion state
  const [isComplexityBudgetOpen, setIsComplexityBudgetOpen] = useState(false);

  const handleDownloadCSV = () => {
    if (!csvContent || !repoName) return;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repoName}-issue-estimations.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const addLog = (message: string) => {
    setStatusLogs((prev) => [...prev, message]);
  };

  const handleRepoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Repository Link:', repoLink);
    console.log('Budget Range:', { min: minBudget, max: maxBudget });
    console.log('Selected Model:', selectedModel);

    setIsLoading(true);
    setCsvContent(null);
    setStatusLogs([]);

    addLog('> SYSTEM INITIALIZED');
    addLog(`> MODEL: ${selectedModel.toUpperCase()}`);
    addLog(`> BUDGET RANGE: $${minBudget || lowMin} - $${maxBudget || criticalMax}`);

    try {
      const response = await fetch('/api/estimate-repo-issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoLink,
          minBudget: minBudget ? Number(minBudget) : undefined,
          maxBudget: maxBudget ? Number(maxBudget) : undefined,
          model: selectedModel,
          lowMin: lowMin ? Number(lowMin) : undefined,
          lowMax: lowMax ? Number(lowMax) : undefined,
          mediumMin: mediumMin ? Number(mediumMin) : undefined,
          mediumMax: mediumMax ? Number(mediumMax) : undefined,
          highMin: highMin ? Number(highMin) : undefined,
          highMax: highMax ? Number(highMax) : undefined,
          criticalMin: criticalMin ? Number(criticalMin) : undefined,
          criticalMax: criticalMax ? Number(criticalMax) : undefined,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start estimation');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'log') {
                addLog(data.message);
              } else if (data.type === 'complete') {
                addLog(data.message);
                setCsvContent(data.data.csvContent);
                setRepoName(`${data.data.repository.owner}_${data.data.repository.repo}`);
              } else if (data.type === 'error') {
                addLog(`> ERROR: ${data.message.toUpperCase()}`);
                alert(`Error: ${data.message}`);
              }
            } catch (e) {
              console.error('Error parsing SSE:', e);
            }
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch issues:', error);
      addLog('> FATAL ERROR: CONNECTION FAILED');
      alert('Failed to fetch and estimate issues. Please try again.');
      setIsLoading(false);
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Issue Link:', issueLink);
    console.log('Budget Range:', { min: minBudget, max: maxBudget });
    console.log('Selected Model:', selectedModel);

    setIsLoading(true);
    setStatusLogs([]);
    setCsvContent(null);

    addLog('> SYSTEM INITIALIZED');
    addLog(`> MODEL: ${selectedModel.toUpperCase()}`);
    addLog(`> ANALYZING SINGLE ISSUE`);

    try {
      addLog('> FETCHING ISSUE DATA...');

      const response = await fetch('/api/estimate-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issueLink,
          minBudget: minBudget ? Number(minBudget) : undefined,
          maxBudget: maxBudget ? Number(maxBudget) : undefined,
          model: selectedModel,
          lowMin: lowMin ? Number(lowMin) : undefined,
          lowMax: lowMax ? Number(lowMax) : undefined,
          mediumMin: mediumMin ? Number(mediumMin) : undefined,
          mediumMax: mediumMax ? Number(mediumMax) : undefined,
          highMin: highMin ? Number(highMin) : undefined,
          highMax: highMax ? Number(highMax) : undefined,
          criticalMin: criticalMin ? Number(criticalMin) : undefined,
          criticalMax: criticalMax ? Number(criticalMax) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to estimate issue');
      }

      const data = await response.json();

      addLog('> ESTIMATION COMPLETE');
      addLog(`> ISSUE #${data.estimation.issueNumber}: ${data.estimation.title}`);
      addLog(`> COMPLEXITY: ${data.estimation.complexity.toUpperCase()}`);
      addLog(`> ESTIMATED COST: $${data.estimation.estimatedCost}`);
      addLog(`> REASONING: ${data.estimation.reasoning}`);

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to estimate issue:', error);
      addLog('> FATAL ERROR: ' + (error instanceof Error ? error.message.toUpperCase() : 'UNKNOWN ERROR'));
      alert('Failed to estimate issue. Please check the issue URL and try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <main className="w-full max-w-2xl">
        <div className="border border-black p-8 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-black">GitHub Analyzer</h1>
            <p className="text-gray-700">
              Enter a repository or issue link to get started
            </p>
          </div>

          <div className="space-y-6">
            {/* Model Selection */}
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-semibold text-black uppercase tracking-wide">
                  OpenAI Model
                </span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="mt-2 w-full px-4 py-3 bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black text-black"
                >
                  <option value="gpt-5">GPT-5</option>
                  <option value="gpt-5-mini">GPT-5 Mini</option>
                  <option value="gpt-5-nano">GPT-5 Nano</option>
                  <option value="gpt-4.1">GPT-4.1</option>
                </select>
              </label>
            </div>

            {/* Overall Budget Range Inputs */}
            <div className="space-y-3">
              <span className="text-sm font-semibold text-black uppercase tracking-wide">
                Overall Budget Range
              </span>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 uppercase">
                    MIN
                  </span>
                  <input
                    type="number"
                    value={minBudget}
                    onChange={(e) => setMinBudget(e.target.value)}
                    placeholder="100"
                    className="mt-1 w-full px-4 py-3 bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 uppercase">
                    MAX
                  </span>
                  <input
                    type="number"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    placeholder="10000"
                    className="mt-1 w-full px-4 py-3 bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-400"
                  />
                </label>
              </div>
            </div>

            {/* Complexity-Specific Budget Ranges (Optional - Accordion) */}
            <div className="border border-black">
              <button
                type="button"
                onClick={() =>
                  setIsComplexityBudgetOpen(!isComplexityBudgetOpen)
                }
                className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-black uppercase tracking-wide">
                  Complexity Budget Ranges (Optional)
                </span>
                <svg
                  className={`w-5 h-5 transition-transform ${isComplexityBudgetOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isComplexityBudgetOpen && (
                <div className="p-4 space-y-4 border-t border-black">
                  {/* Low Complexity */}
                  <div className="space-y-2 p-4 border border-gray-300">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-black uppercase">
                        Low
                      </span>
                      <span className="text-xs text-gray-600">
                        Simple fixes, docs, tweaks
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        value={lowMin}
                        onChange={(e) => setLowMin(e.target.value)}
                        placeholder="Min"
                        className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black text-sm text-black placeholder-gray-400"
                      />
                      <input
                        type="number"
                        value={lowMax}
                        onChange={(e) => setLowMax(e.target.value)}
                        placeholder="Max"
                        className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black text-sm text-black placeholder-gray-400"
                      />
                    </div>
                  </div>

                  {/* Medium Complexity */}
                  <div className="space-y-2 p-4 border border-gray-300">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-black uppercase">
                        Medium
                      </span>
                      <span className="text-xs text-gray-600">
                        Enhancements, integrations, UI
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        value={mediumMin}
                        onChange={(e) => setMediumMin(e.target.value)}
                        placeholder="Min"
                        className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black text-sm text-black placeholder-gray-400"
                      />
                      <input
                        type="number"
                        value={mediumMax}
                        onChange={(e) => setMediumMax(e.target.value)}
                        placeholder="Max"
                        className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black text-sm text-black placeholder-gray-400"
                      />
                    </div>
                  </div>

                  {/* High Complexity */}
                  <div className="space-y-2 p-4 border border-gray-300">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-black uppercase">
                        High
                      </span>
                      <span className="text-xs text-gray-600">
                        Major features, architecture
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        value={highMin}
                        onChange={(e) => setHighMin(e.target.value)}
                        placeholder="Min"
                        className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black text-sm text-black placeholder-gray-400"
                      />
                      <input
                        type="number"
                        value={highMax}
                        onChange={(e) => setHighMax(e.target.value)}
                        placeholder="Max"
                        className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black text-sm text-black placeholder-gray-400"
                      />
                    </div>
                  </div>

                  {/* Critical Complexity */}
                  <div className="space-y-2 p-4 border border-gray-300">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-black uppercase">
                        Critical
                      </span>
                      <span className="text-xs text-gray-600">
                        Overhauls, redesigns, distributed
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        value={criticalMin}
                        onChange={(e) => setCriticalMin(e.target.value)}
                        placeholder="Min"
                        className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black text-sm text-black placeholder-gray-400"
                      />
                      <input
                        type="number"
                        value={criticalMax}
                        onChange={(e) => setCriticalMax(e.target.value)}
                        placeholder="Max"
                        className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black text-sm text-black placeholder-gray-400"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 italic">
                    Leave empty to automatically divide the overall budget range
                    equally across complexity levels
                  </p>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 uppercase text-xs font-medium">
                  Submit Link
                </span>
              </div>
            </div>

            {/* Repository Link Input */}
            <form onSubmit={handleRepoSubmit} className="space-y-3">
              <label className="block">
                <span className="text-sm font-semibold text-black uppercase tracking-wide">
                  GitHub Repository Link
                </span>
                <div className="mt-2 flex gap-3">
                  <input
                    type="text"
                    value={repoLink}
                    onChange={(e) => setRepoLink(e.target.value)}
                    placeholder="github.com/username/repository"
                    className="flex-1 px-4 py-3 bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-400"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-3 bg-black hover:bg-gray-800 text-white font-medium uppercase text-sm tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Processing...' : 'Submit'}
                  </button>
                </div>
              </label>
            </form>

            {/* Status Log */}
            {statusLogs.length > 0 && (
              <div className="border border-cyan-500 bg-black p-4 font-mono text-xs max-h-64 overflow-y-auto">
                <div className="space-y-1">
                  {statusLogs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-cyan-500 flex-shrink-0">
                        {index === statusLogs.length - 1 && isLoading ? '█' : '›'}
                      </span>
                      <span className="text-cyan-400">{log}</span>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-cyan-500 animate-pulse">█</span>
                      <span className="text-cyan-400 animate-pulse">PROCESSING...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CSV Download Button */}
            {csvContent && (
              <div className="border border-green-500 bg-black p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-green-400 uppercase tracking-wide font-mono">
                      [ ESTIMATION COMPLETE ]
                    </p>
                    <p className="text-xs text-green-500 font-mono">
                      CSV FILE READY
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadCSV}
                    className="px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold uppercase text-sm tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                  >
                    DOWNLOAD
                  </button>
                </div>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 uppercase text-xs font-medium">
                  OR
                </span>
              </div>
            </div>

            {/* Issue Link Input */}
            <form onSubmit={handleIssueSubmit} className="space-y-3">
              <label className="block">
                <span className="text-sm font-semibold text-black uppercase tracking-wide">
                  GitHub Issue Link
                </span>
                <div className="mt-2 flex gap-3">
                  <input
                    type="text"
                    value={issueLink}
                    onChange={(e) => setIssueLink(e.target.value)}
                    placeholder="github.com/username/repository/issues/123"
                    className="flex-1 px-4 py-3 bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-400"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-3 bg-black hover:bg-gray-800 text-white font-medium uppercase text-sm tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Processing...' : 'Submit'}
                  </button>
                </div>
              </label>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
