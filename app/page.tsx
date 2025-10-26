"use client";

import { useState } from "react";

export default function Home() {
  const [repoLink, setRepoLink] = useState("");
  const [issueLink, setIssueLink] = useState("");

  const handleRepoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Repository Link:", repoLink);
    // Add your submit logic here
  };

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Issue Link:", issueLink);
    // Add your submit logic here
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-4">
      <main className="w-full max-w-2xl">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-8 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              GitHub Analyzer
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Enter a repository or issue link to get started
            </p>
          </div>

          <div className="space-y-6">
            {/* Repository Link Input */}
            <form onSubmit={handleRepoSubmit} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  GitHub Repository Link
                </span>
                <div className="mt-2 flex gap-3">
                  <input
                    type="url"
                    value={repoLink}
                    onChange={(e) => setRepoLink(e.target.value)}
                    placeholder="https://github.com/username/repository"
                    className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
                  >
                    Submit
                  </button>
                </div>
              </label>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  OR
                </span>
              </div>
            </div>

            {/* Issue Link Input */}
            <form onSubmit={handleIssueSubmit} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  GitHub Issue Link
                </span>
                <div className="mt-2 flex gap-3">
                  <input
                    type="url"
                    value={issueLink}
                    onChange={(e) => setIssueLink(e.target.value)}
                    placeholder="https://github.com/username/repository/issues/123"
                    className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
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
