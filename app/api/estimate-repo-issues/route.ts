import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repoLink } = body;

    if (!repoLink) {
      return NextResponse.json(
        { error: 'Repository link is required' },
        { status: 400 }
      );
    }

    // Parse GitHub repository URL
    const match = repoLink.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL' },
        { status: 400 }
      );
    }

    const [, owner, repo] = match;

    // Initialize Octokit (add your GitHub token for higher rate limits)
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN, // Optional: add token to .env for higher rate limits
    });

    console.log(`Fetching all open issues for ${owner}/${repo}...`);

    // Fetch all open issues with pagination
    const allIssues = [];
    let page = 1;
    const perPage = 100; // Maximum allowed per page

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
      const actualIssues = issues.filter((issue: any) => !issue.pull_request);

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

    return NextResponse.json({
      success: true,
      repository: { owner, repo },
      totalIssues: allIssues.length,
      issues: allIssues,
    });

  } catch (error: any) {
    console.error('Error fetching issues:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch issues' },
      { status: 500 }
    );
  }
}
