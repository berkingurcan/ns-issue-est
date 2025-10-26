"use client";

import { useState } from "react";

export default function Home() {
  const [repoLink, setRepoLink] = useState("");
  const [issueLink, setIssueLink] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");

  const handleRepoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Repository Link:", repoLink);
    console.log("Budget Range:", { min: minBudget, max: maxBudget });
    // Add your submit logic here
  };

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Issue Link:", issueLink);
    console.log("Budget Range:", { min: minBudget, max: maxBudget });
    // Add your submit logic here
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <main className="w-full max-w-2xl">
        <div className="border border-black p-8 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-black">
              GitHub Analyzer
            </h1>
            <p className="text-gray-700">
              Enter a repository or issue link to get started
            </p>
          </div>

          <div className="space-y-6">
            {/* Budget Range Inputs */}
            <div className="space-y-3">
              <span className="text-sm font-semibold text-black uppercase tracking-wide">
                Budget Range
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
                    placeholder="0"
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
                    type="url"
                    value={repoLink}
                    onChange={(e) => setRepoLink(e.target.value)}
                    placeholder="https://github.com/username/repository"
                    className="flex-1 px-4 py-3 bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-400"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-black hover:bg-gray-800 text-white font-medium uppercase text-sm tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    Submit
                  </button>
                </div>
              </label>
            </form>

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
                    type="url"
                    value={issueLink}
                    onChange={(e) => setIssueLink(e.target.value)}
                    placeholder="https://github.com/username/repository/issues/123"
                    className="flex-1 px-4 py-3 bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-400"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-black hover:bg-gray-800 text-white font-medium uppercase text-sm tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    Submit
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
