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
import logger from '@/app/_lib/utils/logger';

// Helper to send server-sent events
function createStreamResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });

  const sendEvent = (data: { type: string; message: string; data?: unknown }) => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(encoder.encode(message));
  };

  const close = () => {
    controller.close();
  };

  return { stream, sendEvent, close };
}

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
      stream: enableStreaming,
    } = body;

    // If streaming is enabled, use SSE
    if (enableStreaming) {
      const { stream, sendEvent, close } = createStreamResponse();

      // Process in background
      (async () => {
        try {
          sendEvent({ type: 'log', message: '> PARSING REPOSITORY URL...' });

          if (!repoLink) {
            sendEvent({ type: 'error', message: 'Repository link is required' });
            close();
            return;
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
            sendEvent({ type: 'error', message: 'Invalid GitHub repository URL' });
            close();
            return;
          }

          const { owner, repo } = repoInfo;

          sendEvent({ type: 'log', message: '> FETCHING REPOSITORY CONTEXT...' });
          const repoContext = await fetchRepoContext(owner, repo);

          sendEvent({ type: 'log', message: '> LOADING OPEN ISSUES...' });
          const allIssues = await fetchAllOpenIssues(owner, repo);
          sendEvent({ type: 'log', message: `> FOUND ${allIssues.length} ISSUES` });

          sendEvent({ type: 'log', message: '> ENRICHING ISSUE DATA...' });
          const enrichedIssues = await Promise.all(
            allIssues.map((issue) => enrichIssueWithComments(owner, repo, issue))
          );

          sendEvent({ type: 'log', message: '> FORMATTING DATA FOR AI...' });
          enrichedIssues.forEach((issue) => {
            formatFullLLMPromptData(repoContext, issue);
            writeFormattedLLMOutput(repoContext, issue);
          });

          sendEvent({ type: 'log', message: '> STARTING AI ESTIMATION...' });

          const estimations: IssueEstimation[] = await estimateIssuesBatch(
            repoContext,
            enrichedIssues,
            estimationParams,
            {
              onProgress: (current, total) => {
                const batchNum = Math.ceil(current / 5);
                const totalBatches = Math.ceil(total / 5);
                if (current % 5 === 0 || current === total) {
                  sendEvent({
                    type: 'log',
                    message: `> BATCH ${batchNum}/${totalBatches} | ISSUES ${current}/${total}`
                  });
                }
              },
              saveToFile: true,
              repoOwner: owner,
              repoName: repo,
            }
          );

          const totalCost = estimations.reduce((sum, est) => sum + est.estimatedCost, 0);
          const avgCost = totalCost / estimations.length;
          const complexityCounts = estimations.reduce(
            (acc, est) => {
              acc[est.complexity] = (acc[est.complexity] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          );

          sendEvent({ type: 'log', message: '> ESTIMATION COMPLETE' });
          sendEvent({ type: 'log', message: `> TOTAL COST: $${totalCost.toFixed(2)}` });
          sendEvent({ type: 'log', message: `> AVG COST: $${avgCost.toFixed(2)}` });
          sendEvent({ type: 'log', message: '> GENERATING CSV...' });

          const csvContent = convertEstimationsToCSV(estimations);
          writeEstimationsToCSV(estimations, owner, repo);

          sendEvent({
            type: 'complete',
            message: '> READY FOR DOWNLOAD',
            data: {
              success: true,
              repository: { owner, repo },
              totalIssues: allIssues.length,
              processedIssues: enrichedIssues.length,
              estimations,
              csvContent,
              summary: { totalCost, avgCost, complexityCounts },
            },
          });

          close();
        } catch (error) {
          sendEvent({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          close();
        }
      })();

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

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

    logger.info({ estimationParams }, 'Estimation parameters configured');

    const repoInfo = parseGitHubRepoUrl(repoLink);
    if (!repoInfo) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL' },
        { status: 400 }
      );
    }

    const { owner, repo } = repoInfo;

    logger.info({ owner, repo }, 'Fetching repository context');
    const repoContext = await fetchRepoContext(owner, repo);

    logger.info('Fetching all open issues');
    const allIssues = await fetchAllOpenIssues(owner, repo);

    const issuesToEnrich = allIssues;
    logger.info({ count: issuesToEnrich.length }, 'Enriching issues with comments');
    const enrichedIssues = await Promise.all(
      issuesToEnrich.map((issue) => enrichIssueWithComments(owner, repo, issue))
    );

    logger.info('Formatting data for LLM');
    enrichedIssues.forEach((issue) => {
      logger.debug({ issueNumber: issue.number }, 'Formatting issue for LLM');
      const llmPromptData = formatFullLLMPromptData(repoContext, issue);
      logger.trace({ llmPromptData }, 'LLM prompt data');
      writeFormattedLLMOutput(repoContext, issue);
    });

    logger.info({ count: enrichedIssues.length }, 'Starting AI estimation');

    const estimations: IssueEstimation[] = await estimateIssuesBatch(
      repoContext,
      enrichedIssues,
      estimationParams,
      {
        onProgress: (current, total) => {
          logger.info({ current, total }, 'Estimation progress');
        },
        saveToFile: true,
        repoOwner: owner,
        repoName: repo,
      }
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

    logger.info(
      {
        totalIssues: estimations.length,
        budgetRange: `$${estimationParams.minBudget} - $${estimationParams.maxBudget}`,
        totalCost,
        avgCost,
        complexityCounts,
      },
      'AI estimation results'
    );

    estimations.forEach((est) => {
      logger.debug(
        {
          issueNumber: est.issueNumber,
          title: est.title,
          complexity: est.complexity,
          estimatedCost: est.estimatedCost,
          labels: est.labels,
          url: est.url,
          reasoning: est.reasoning,
        },
        'Issue estimation detail'
      );
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
    logger.error({ error }, 'Error fetching and estimating issues');
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch issues',
      },
      { status: 500 }
    );
  }
}
