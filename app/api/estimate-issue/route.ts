import { NextResponse } from 'next/server';
import {
  fetchRepoContext,
  enrichIssueWithComments,
  formatFullLLMPromptData,
} from '@/app/_lib/services/github';
import {
  estimateIssuesBatch,
  EstimationParams,
  EXAMPLE_PARAMS,
} from '@/app/_lib/services/ai';
import { Octokit } from 'octokit';
import logger from '@/app/_lib/utils/logger';

function parseGitHubIssueUrl(issueLink: string): { owner: string; repo: string; issueNumber: number } | null {
  let normalized = issueLink.trim();

  if (!normalized.match(/^https?:\/\//)) {
    normalized = `https://${normalized}`;
  }

  normalized = normalized.replace(/^(https?:\/\/)www\./, '$1');
  normalized = normalized.replace(/\/+$/, '');

  const match = normalized.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
  if (!match) {
    return null;
  }

  const [, owner, repo, issueNumber] = match;
  return { owner, repo, issueNumber: parseInt(issueNumber, 10) };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      issueLink,
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

    if (!issueLink) {
      return NextResponse.json(
        { error: 'Issue link is required' },
        { status: 400 }
      );
    }

    const issueInfo = parseGitHubIssueUrl(issueLink);
    if (!issueInfo) {
      return NextResponse.json(
        { error: 'Invalid GitHub issue URL. Expected format: github.com/owner/repo/issues/123' },
        { status: 400 }
      );
    }

    const { owner, repo, issueNumber } = issueInfo;

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

    logger.info({ owner, repo, issueNumber }, 'Fetching issue');

    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    const issueResponse = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    const issue = issueResponse.data;

    if ('pull_request' in issue) {
      return NextResponse.json(
        { error: 'This is a pull request, not an issue' },
        { status: 400 }
      );
    }

    logger.info('Fetching repository context');
    const repoContext = await fetchRepoContext(owner, repo);

    logger.info('Enriching issue data');
    const enrichedIssue = await enrichIssueWithComments(owner, repo, issue);

    logger.info('Formatting data for LLM');
    const llmPromptData = formatFullLLMPromptData(repoContext, enrichedIssue);
    logger.debug({ llmPromptData }, 'LLM prompt data formatted');

    logger.info('Starting AI estimation');
    const estimations = await estimateIssuesBatch(
      repoContext,
      [enrichedIssue],
      estimationParams,
      {
        onProgress: (current, total) => {
          logger.info({ current, total }, 'Estimation progress');
        },
        saveToFile: false,
      }
    );

    const estimation = estimations[0];

    logger.info(
      {
        issueNumber: estimation.issueNumber,
        title: estimation.title,
        complexity: estimation.complexity,
        estimatedCost: estimation.estimatedCost,
      },
      'Estimation complete'
    );
    logger.debug({ reasoning: estimation.reasoning }, 'Estimation reasoning');

    return NextResponse.json({
      success: true,
      repository: { owner, repo },
      estimation,
      message: `Successfully estimated issue #${issueNumber}`,
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Error estimating issue');
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to estimate issue',
      },
      { status: 500 }
    );
  }
}
