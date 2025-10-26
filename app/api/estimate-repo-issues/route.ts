import { NextResponse } from 'next/server';
import {
  parseGitHubRepoUrl,
  fetchAllOpenIssues,
  fetchRepoContext,
  enrichIssueWithComments,
  formatFullLLMPromptData,
  writeFormattedLLMOutput,
} from '@/app/_lib/services/github';

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

    const repoContext = await fetchRepoContext(owner, repo);

    const allIssues = await fetchAllOpenIssues(owner, repo);

    const issuesToEnrich = allIssues;
    const enrichedIssues = await Promise.all(
      issuesToEnrich.map((issue) => enrichIssueWithComments(owner, repo, issue))
    );

    // Step 4: Format data for LLM estimation and write to files
    console.log('\n===Formatting Data for LLM ===');
    enrichedIssues.forEach((issue, index) => {
      console.log(`\n--- Issue #${issue.number} LLM Input Format ---`);
      const llmPromptData = formatFullLLMPromptData(repoContext, issue);
      console.log(llmPromptData);
      console.log('\n--- End of Issue ---\n');

      // Write formatted output to files
      writeFormattedLLMOutput(repoContext, issue);
    });

    return NextResponse.json({
      success: true,
      repository: { owner, repo },
      repoContext,
      totalIssues: allIssues.length,
      processedIssues: enrichedIssues.length,
      enrichedIssues,
      message: `Processed ${enrichedIssues.length} issues. Check server logs for formatted LLM input data.`,
    });
  } catch (error: unknown) {
    console.error('Error fetching issues:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch issues',
      },
      { status: 500 }
    );
  }
}
