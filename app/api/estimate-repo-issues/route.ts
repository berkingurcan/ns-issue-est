import { NextResponse } from 'next/server';
import { parseGitHubRepoUrl, fetchAllOpenIssues } from '@/app/_lib/services/github';

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

    const repoInfo = parseGitHubRepoUrl(repoLink);
    if (!repoInfo) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL' },
        { status: 400 }
      );
    }

    const { owner, repo } = repoInfo;
    const allIssues = await fetchAllOpenIssues(owner, repo);

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
