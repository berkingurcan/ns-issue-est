import { NextResponse } from 'next/server';
import {
  parseGitHubRepoUrl,
  fetchAllOpenIssues,
  fetchRepoContext,
  enrichIssueWithComments,
  formatFullLLMPromptData,
  writeFormattedLLMOutput,
} from '@/app/_lib/services/github';
import {
  estimateIssuesBatch,
  EstimationParams,
  IssueEstimation,
  EXAMPLE_PARAMS,
  convertEstimationsToCSV,
  writeEstimationsToCSV,
} from '@/app/_lib/services/ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      repoLink,
      minBudget,
      maxBudget,
      model,
      lowMin,
      lowMax,
      mediumMin,
      mediumMax,
      highMin,
      highMax,
      criticalMin,
      criticalMax,
    } = body;

    if (!repoLink) {
      return NextResponse.json(
        { error: 'Repository link is required' },
        { status: 400 }
      );
    }

    // Use provided estimation params or defaults
    const estimationParams: EstimationParams = {
      minBudget: minBudget ?? EXAMPLE_PARAMS.minBudget,
      maxBudget: maxBudget ?? EXAMPLE_PARAMS.maxBudget,
      model: model ?? EXAMPLE_PARAMS.model,
    };

    // Add complexity-specific budgets if all are provided
    if (
      lowMin !== undefined &&
      lowMax !== undefined &&
      mediumMin !== undefined &&
      mediumMax !== undefined &&
      highMin !== undefined &&
      highMax !== undefined &&
      criticalMin !== undefined &&
      criticalMax !== undefined
    ) {
      estimationParams.complexityBudgets = {
        low: { min: Number(lowMin), max: Number(lowMax) },
        medium: { min: Number(mediumMin), max: Number(mediumMax) },
        high: { min: Number(highMin), max: Number(highMax) },
        critical: { min: Number(criticalMin), max: Number(criticalMax) },
      };
    }

    console.log('\n=== Estimation Parameters ===');
    console.log(JSON.stringify(estimationParams, null, 2));

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
    console.log('\n=== Formatting Data for LLM ===');
    enrichedIssues.forEach((issue, index) => {
      console.log(`\n--- Issue #${issue.number} LLM Input Format ---`);
      const llmPromptData = formatFullLLMPromptData(repoContext, issue);
      console.log(llmPromptData);
      console.log('\n--- End of Issue ---\n');

      // Write formatted output to files
      writeFormattedLLMOutput(repoContext, issue);
    });

    // Step 5: Estimate issues using AI
    console.log('\n=== Starting AI Estimation ===');
    console.log(`Estimating ${enrichedIssues.length} issues...`);

    const estimations: IssueEstimation[] = await estimateIssuesBatch(
      repoContext,
      enrichedIssues,
      estimationParams,
      {
        onProgress: (current, total) => {
          console.log(`Progress: ${current}/${total} issues estimated`);
        },
        saveToFile: true,
        repoOwner: owner,
        repoName: repo,
      }
    );

    // Step 6: Log estimation results
    console.log('\n=== AI Estimation Results ===');
    console.log(
      `Total Issues Estimated: ${estimations.length} | Budget Range: $${estimationParams.minBudget} - $${estimationParams.maxBudget}`
    );

    const totalCost = estimations.reduce(
      (sum, est) => sum + est.estimatedCost,
      0
    );
    const avgCost = totalCost / estimations.length;

    const complexityCounts = estimations.reduce(
      (acc, est) => {
        acc[est.complexity] = (acc[est.complexity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log('\n--- Summary Statistics ---');
    console.log(`Total Estimated Cost: $${totalCost.toFixed(2)}`);
    console.log(`Average Cost per Issue: $${avgCost.toFixed(2)}`);
    console.log('Complexity Distribution:');
    Object.entries(complexityCounts).forEach(([complexity, count]) => {
      console.log(`  ${complexity}: ${count} issues`);
    });

    console.log('\n--- Detailed Estimations ---');
    estimations.forEach((est) => {
      console.log(`\nIssue #${est.issueNumber}: ${est.title}`);
      console.log(`  Complexity: ${est.complexity}`);
      console.log(`  Estimated Cost: $${est.estimatedCost}`);
      console.log(`  Labels: ${est.labels.join(', ') || 'None'}`);
      console.log(`  Reasoning: ${est.reasoning}`);
      console.log(`  URL: ${est.url}`);
    });

    // Generate CSV content
    const csvContent = convertEstimationsToCSV(estimations);

    // Also write to file for server-side record
    writeEstimationsToCSV(estimations, owner, repo);

    return NextResponse.json({
      success: true,
      repository: { owner, repo },
      repoContext,
      estimationParams,
      totalIssues: allIssues.length,
      processedIssues: enrichedIssues.length,
      estimations,
      csvContent,
      summary: {
        totalCost,
        avgCost,
        complexityCounts,
      },
      message: `Processed and estimated ${estimations.length} issues. Total estimated cost: $${totalCost.toFixed(2)}`,
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
