import { Octokit } from 'octokit';

interface RepoInfo {
  owner: string;
  repo: string;
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
