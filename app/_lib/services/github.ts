import { Octokit } from 'octokit';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface RepoInfo {
  owner: string;
  repo: string;
}

export interface RepoContext {
  name: string;
  fullName: string;
  description: string | null;
  languages: Record<string, number>;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  openIssuesCount: number;
  size: number; // in KB
  createdAt: string;
  updatedAt: string;
  hasTests: boolean;
  topics: string[];
  license: string | null;
}

export interface IssueComment {
  id: number;
  body: string;
  createdAt: string;
  author: string;
}

export interface EnrichedIssue {
  number: number;
  title: string;
  body: string | null;
  labels: string[];
  state: string;
  createdAt: string;
  updatedAt: string;
  comments: IssueComment[];
  commentCount: number;
  url: string;
  author: string;
}

export function parseGitHubRepoUrl(repoLink: string): RepoInfo | null {
  // Normalize the input: trim whitespace
  let normalized = repoLink.trim();

  // Add https:// if no protocol is specified
  if (!normalized.match(/^https?:\/\//)) {
    normalized = `https://${normalized}`;
  }

  // Remove www. if present
  normalized = normalized.replace(/^(https?:\/\/)www\./, '$1');

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  // Remove .git suffix if present
  normalized = normalized.replace(/\.git$/, '');

  // Match github.com/owner/repo pattern
  const match = normalized.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    return null;
  }

  const [, owner, repo] = match;
  return { owner, repo };
}

export async function fetchAllOpenIssues(owner: string, repo: string) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  console.log(`Fetching all open issues for ${owner}/${repo}...`);

  const allIssues = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    console.log(`Fetching page ${page}...`);

    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'open',
      per_page: perPage,
      page,
    });

    const issues = response.data;

    // Filter out pull requests (GitHub API returns both issues and PRs)
    const actualIssues = issues.filter((issue) => !('pull_request' in issue));

    allIssues.push(...actualIssues);

    console.log(`Page ${page}: Found ${actualIssues.length} issues`);

    // If we got less than perPage items, we've reached the end
    if (issues.length < perPage) {
      break;
    }

    page++;
  }

  console.log(`\nTotal open issues fetched: ${allIssues.length}`);
  console.log('\n=== All Issues Data ===');
  console.log(JSON.stringify(allIssues, null, 2));

  return allIssues;
}

export async function fetchRepoContext(
  owner: string,
  repo: string
): Promise<RepoContext> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  console.log(`Fetching repository context for ${owner}/${repo}...`);

  // Fetch repository metadata
  const repoResponse = await octokit.rest.repos.get({
    owner,
    repo,
  });

  const repoData = repoResponse.data;

  // Fetch languages
  const languagesResponse = await octokit.rest.repos.listLanguages({
    owner,
    repo,
  });

  const languages = languagesResponse.data;

  // Calculate primary language (most bytes)
  let primaryLanguage = repoData.language;
  if (!primaryLanguage && Object.keys(languages).length > 0) {
    primaryLanguage = Object.entries(languages).sort(
      ([, a], [, b]) => b - a
    )[0][0];
  }

  // Check for test indicators in repo
  const hasTests = await checkForTests(octokit, owner, repo);

  const context: RepoContext = {
    name: repoData.name,
    fullName: repoData.full_name,
    description: repoData.description,
    languages,
    primaryLanguage,
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    openIssuesCount: repoData.open_issues_count,
    size: repoData.size,
    createdAt: repoData.created_at,
    updatedAt: repoData.updated_at,
    hasTests,
    topics: repoData.topics || [],
    license: repoData.license?.name || null,
  };

  console.log('Repository context fetched successfully');
  return context;
}

async function checkForTests(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    // Check for common test directories and files
    const testIndicators = [
      'test',
      'tests',
      '__tests__',
      'spec',
      'specs',
      'test.js',
      'test.ts',
      '.spec.js',
      '.spec.ts',
      'jest.config.js',
      'vitest.config.js',
      'pytest.ini',
    ];

    // Search for test-related files
    for (const indicator of testIndicators.slice(0, 5)) {
      // Check first 5 to avoid rate limits
      try {
        await octokit.rest.repos.getContent({
          owner,
          repo,
          path: indicator,
        });
        return true; // Found a test directory/file
      } catch {
        // Continue checking
      }
    }

    return false;
  } catch {
    return false;
  }
}

export async function fetchIssueComments(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<IssueComment[]> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const allComments: IssueComment[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const commentsResponse = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: perPage,
      page,
    });

    const comments = commentsResponse.data.map((comment) => ({
      id: comment.id,
      body: comment.body || '',
      createdAt: comment.created_at,
      author: comment.user?.login || 'unknown',
    }));

    allComments.push(...comments);

    // If we got less than perPage items, we've reached the end
    if (commentsResponse.data.length < perPage) {
      break;
    }

    page++;
  }

  return allComments;
}

export async function enrichIssueWithComments(
  owner: string,
  repo: string,
  issue: any
): Promise<EnrichedIssue> {
  const comments = await fetchIssueComments(owner, repo, issue.number);

  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels: issue.labels.map((label: any) => label.name),
    state: issue.state,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    comments,
    commentCount: issue.comments,
    url: issue.html_url,
    author: issue.user?.login || 'unknown',
  };
}

export interface LLMEstimationInput {
  repoContext: RepoContext;
  issue: EnrichedIssue;
}

export function formatForLLMEstimation(
  repoContext: RepoContext,
  issue: EnrichedIssue
): LLMEstimationInput {
  return {
    repoContext,
    issue,
  };
}

export function formatRepoContextSummary(context: RepoContext): string {
  const languageBreakdown = Object.entries(context.languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([lang, bytes]) => {
      const total = Object.values(context.languages).reduce(
        (sum, val) => sum + val,
        0
      );
      const percentage = ((bytes / total) * 100).toFixed(1);
      return `${lang} (${percentage}%)`;
    })
    .join(', ');

  return `Repository: ${context.fullName}
Description: ${context.description || 'No description'}
Primary Language: ${context.primaryLanguage || 'Unknown'}
Languages: ${languageBreakdown || 'None detected'}
Stars: ${context.stars}
Size: ${(context.size / 1024).toFixed(1)} MB
Has Test Suite: ${context.hasTests ? 'Yes' : 'No'}
Topics: ${context.topics.length > 0 ? context.topics.join(', ') : 'None'}
License: ${context.license || 'None'}
Created: ${new Date(context.createdAt).toLocaleDateString()}
Last Updated: ${new Date(context.updatedAt).toLocaleDateString()}`;
}

export function formatIssueSummary(issue: EnrichedIssue): string {
  return `Issue #${issue.number}: ${issue.title}
URL: ${issue.url}
Author: ${issue.author}
Created: ${new Date(issue.createdAt).toLocaleDateString()}
Labels: ${issue.labels.length > 0 ? issue.labels.join(', ') : 'None'}
Comments: ${issue.commentCount}

Description:
${issue.body || 'No description provided'}

${
  issue.comments.length > 0
    ? `
All Comments (${issue.comments.length}):
${issue.comments
  .map(
    (c) =>
      `- ${c.author} (${new Date(c.createdAt).toLocaleDateString()}): ${c.body}`
  )
  .join('\n')}`
    : 'No comments'
}`;
}

export function formatFullLLMPromptData(
  repoContext: RepoContext,
  issue: EnrichedIssue
): string {
  return `${formatRepoContextSummary(repoContext)}

---

${formatIssueSummary(issue)}`;
}

export function writeFormattedLLMOutput(
  repoContext: RepoContext,
  issue: EnrichedIssue,
  baseDir: string = process.cwd()
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const repoName = repoContext.name;
  const issueNumber = issue.number;

  // Create llm-outputs directory if it doesn't exist
  const outputDir = join(baseDir, 'llm-outputs');
  mkdirSync(outputDir, { recursive: true });

  // Write as JSON
  const jsonOutput = {
    repoContext,
    issue,
  };
  const jsonPath = join(
    outputDir,
    `${repoName}-issue-${issueNumber}-${timestamp}.json`
  );
  writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`Written JSON output to: ${jsonPath}`);

  // Write as formatted text/markdown
  const textOutput = formatFullLLMPromptData(repoContext, issue);
  const textPath = join(
    outputDir,
    `${repoName}-issue-${issueNumber}-${timestamp}.md`
  );
  writeFileSync(textPath, textOutput);
  console.log(`Written formatted text output to: ${textPath}`);
}
