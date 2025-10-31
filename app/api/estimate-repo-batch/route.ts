import { NextResponse } from 'next/server';
import {
  parseGitHubRepoUrl,
  fetchAllOpenIssues,
  fetchRepoContext,
  enrichIssueWithComments,
  formatFullLLMPromptData,
} from '@/app/_lib/services/github';
import {
  estimateIssuesBatch,
  EstimationParams,
  IssueEstimation,
  EXAMPLE_PARAMS,
} from '@/app/_lib/services/ai';
import logger from '@/app/_lib/utils/logger';
import { checkRateLimit } from '@/app/_lib/middleware/rateLimit';

export const maxDuration = 60; // Set to max for free tier

export async function POST(request: Request) {
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

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
      startIndex = 0,
      batchSize = 15,
    } = body;

    if (!repoLink) {
      return NextResponse.json(
        { error: 'Repository link is required' },
        { status: 400 }
      );
    }

    const estimationParams: EstimationParams = {
      minBudget: minBudget ?? EXAMPLE_PARAMS.minBudget,
      maxBudget: maxBudget ?? EXAMPLE_PARAMS.maxBudget,
      model: model ?? EXAMPLE_PARAMS.model,
    };

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

    const repoInfo = parseGitHubRepoUrl(repoLink);
    if (!repoInfo) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL' },
        { status: 400 }
      );
    }

    const { owner, repo } = repoInfo;

    // Only fetch repo context and issues list on first batch
    let repoContext;
    let allIssues;
    let totalIssues;

    if (startIndex === 0) {
      logger.info({ owner, repo }, 'Fetching repository context');
      repoContext = await fetchRepoContext(owner, repo);

      logger.info('Fetching all open issues');
      allIssues = await fetchAllOpenIssues(owner, repo);
      totalIssues = allIssues.length;
    } else {
      // For subsequent batches, only fetch the issues
      logger.info('Fetching all open issues');
      allIssues = await fetchAllOpenIssues(owner, repo);
      totalIssues = allIssues.length;

      // Still need repo context for processing
      logger.info({ owner, repo }, 'Fetching repository context');
      repoContext = await fetchRepoContext(owner, repo);
    }

    // Get the batch of issues to process
    const issuesToProcess = allIssues.slice(startIndex, startIndex + batchSize);

    if (issuesToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        repository: { owner, repo },
        totalIssues,
        startIndex,
        batchSize,
        processedCount: 0,
        estimations: [],
        isComplete: true,
        message: 'No more issues to process',
      });
    }

    logger.info({ count: issuesToProcess.length, startIndex }, 'Enriching issues with comments');
    const enrichedIssues = await Promise.all(
      issuesToProcess.map((issue) => enrichIssueWithComments(owner, repo, issue))
    );

    logger.info('Formatting data for LLM');
    enrichedIssues.forEach((issue) => {
      formatFullLLMPromptData(repoContext, issue);
    });

    logger.info({ count: enrichedIssues.length }, 'Starting AI estimation for batch');

    const estimations: IssueEstimation[] = await estimateIssuesBatch(
      repoContext,
      enrichedIssues,
      estimationParams,
      {
        onProgress: (current, total) => {
          logger.info({ current, total, batchStart: startIndex }, 'Estimation progress');
        },
        saveToFile: false, // Don't save individual batches
        repoOwner: owner,
        repoName: repo,
      }
    );

    const isComplete = startIndex + batchSize >= totalIssues;

    return NextResponse.json({
      success: true,
      repository: { owner, repo },
      repoContext: startIndex === 0 ? repoContext : undefined, // Only send context on first batch
      totalIssues,
      startIndex,
      batchSize,
      processedCount: issuesToProcess.length,
      estimations,
      isComplete,
      nextStartIndex: isComplete ? null : startIndex + batchSize,
      message: `Processed batch: ${startIndex + 1}-${startIndex + issuesToProcess.length} of ${totalIssues} issues`,
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Error in batch estimation');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process batch',
      },
      { status: 500 }
    );
  }
}
