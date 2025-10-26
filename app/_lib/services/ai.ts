import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { EnrichedIssue, RepoContext } from './github';
import { generateSystemPrompt, generateUserPrompt } from './prompts';
import logger from '@/app/_lib/utils/logger';

export interface IssueEstimation {
  issueNumber: number;
  title: string;
  complexity: 'low' | 'medium' | 'high' | 'critical';
  estimatedCost: number;
  reasoning: string;
  labels: string[];
  url: string;
}

export interface ComplexityBudgetRange {
  min: number;
  max: number;
}

export interface EstimationParams {
  minBudget: number;
  maxBudget: number;
  model: string;
  complexityBudgets?: {
    low?: ComplexityBudgetRange;
    medium?: ComplexityBudgetRange;
    high?: ComplexityBudgetRange;
    critical?: ComplexityBudgetRange;
  };
}


/**
 * Estimate a single issue using OpenAI API
 */
export async function estimateIssue(
  repoContext: RepoContext,
  issue: EnrichedIssue,
  params: EstimationParams,
  options?: { saveToFile?: boolean; repoOwner?: string; repoName?: string }
): Promise<IssueEstimation> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = generateSystemPrompt(params);
  const userPrompt = generateUserPrompt(repoContext, issue);

  try {
    logger.info(
      { issueNumber: issue.number, title: issue.title.substring(0, 50) },
      'Estimating issue with AI'
    );

    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      seed: 42,
      model: params.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });
    const duration = Date.now() - startTime;

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new Error('Empty response from OpenAI');
    }

    const estimation = JSON.parse(responseContent);

    logger.info(
      {
        issueNumber: issue.number,
        complexity: estimation.complexity,
        estimatedCost: estimation.estimatedCost,
        duration,
      },
      'AI estimation completed'
    );
    logger.debug({ reasoning: estimation.reasoning }, 'Estimation reasoning');

    if (completion.usage) {
      logger.debug(
        {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        },
        'Token usage'
      );
    }

    const result: IssueEstimation = {
      issueNumber: issue.number,
      title: issue.title,
      complexity: estimation.complexity,
      estimatedCost: estimation.estimatedCost,
      reasoning: estimation.reasoning,
      labels: issue.labels,
      url: issue.url,
    };

    // Write to file if requested
    if (options?.saveToFile && options.repoOwner && options.repoName) {
      writeEstimationToFile(result, options.repoOwner, options.repoName);
    }

    return result;
  } catch (error) {
    logger.error(
      { error, issueNumber: issue.number },
      'Error estimating issue with AI'
    );
    throw new Error(
      `Failed to estimate issue #${issue.number}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Estimate multiple issues in batches
 */
export async function estimateIssuesBatch(
  repoContext: RepoContext,
  issues: EnrichedIssue[],
  params: EstimationParams,
  options?: {
    onProgress?: (current: number, total: number) => void;
    saveToFile?: boolean;
    repoOwner?: string;
    repoName?: string;
  }
): Promise<IssueEstimation[]> {
  const estimations: IssueEstimation[] = [];
  const batchSize = 5; // Process 5 issues at a time

  logger.info(
    { totalIssues: issues.length, batchSize },
    'Starting batch estimation'
  );
  const batchStartTime = Date.now();

  for (let i = 0; i < issues.length; i += batchSize) {
    const batch = issues.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(issues.length / batchSize);

    logger.info(
      {
        batchNumber,
        totalBatches,
        issueRange: `${i + 1}-${Math.min(i + batchSize, issues.length)}`,
      },
      'Processing batch'
    );

    // Process batch in parallel
    const batchEstimations = await Promise.all(
      batch.map((issue) =>
        estimateIssue(repoContext, issue, params, {
          saveToFile: options?.saveToFile,
          repoOwner: options?.repoOwner,
          repoName: options?.repoName,
        })
      )
    );

    estimations.push(...batchEstimations);

    // Report progress
    const currentCount = Math.min(i + batchSize, issues.length);
    if (options?.onProgress) {
      options.onProgress(currentCount, issues.length);
    }

    logger.info(
      {
        batchNumber,
        totalBatches,
        currentCount,
        totalIssues: issues.length,
      },
      'Completed batch'
    );
  }

  const totalDuration = Date.now() - batchStartTime;
  logger.info(
    { totalDuration, durationSeconds: (totalDuration / 1000).toFixed(2) },
    'Completed all estimations'
  );

  return estimations;
}

/**
 * Example usage of the estimation functions
 */
export const EXAMPLE_PARAMS: EstimationParams = {
  minBudget: 100,
  maxBudget: 1000,
  model: 'gpt-5-nano',
};

/**
 * Available OpenAI models for estimation
 */
export const AVAILABLE_MODELS = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4.1',
] as const;

export type AvailableModel = (typeof AVAILABLE_MODELS)[number];

/**
 * Write estimation result to a JSON file
 */
export function writeEstimationToFile(
  estimation: IssueEstimation,
  repoOwner: string,
  repoName: string
): void {
  // Skip file writing in production
  if (process.env.NODE_ENV === 'production') {
    logger.debug({ issueNumber: estimation.issueNumber }, 'Skipping file write in production');
    return;
  }

  const outputDir = path.join(
    process.cwd(),
    'estimation-results',
    `${repoOwner}_${repoName}`
  );

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `issue-${estimation.issueNumber}.json`;
  const filepath = path.join(outputDir, filename);

  const output = {
    issueNumber: estimation.issueNumber,
    title: estimation.title,
    complexity: estimation.complexity,
    estimatedCost: estimation.estimatedCost,
    reasoning: estimation.reasoning,
    labels: estimation.labels,
    url: estimation.url,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
  logger.debug({ filepath }, 'Wrote estimation to file');
}

/**
 * Convert estimations array to CSV format
 */
export function convertEstimationsToCSV(
  estimations: IssueEstimation[]
): string {
  // CSV header
  const header = 'issue_number,title,complexity,estimated_cost,labels,reasoning,url';

  // CSV rows
  const rows = estimations.map((est) => {
    // Escape and quote fields that might contain commas or quotes
    const escapeCSVField = (field: string): string => {
      // Replace double quotes with two double quotes and wrap in quotes if contains comma, quote, or newline
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    return [
      est.issueNumber,
      escapeCSVField(est.title),
      est.complexity,
      est.estimatedCost,
      escapeCSVField(est.labels.join('; ')),
      escapeCSVField(est.reasoning),
      est.url,
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Write estimations to a CSV file
 */
export function writeEstimationsToCSV(
  estimations: IssueEstimation[],
  repoOwner: string,
  repoName: string
): string {
  // Skip file writing in production
  if (process.env.NODE_ENV === 'production') {
    logger.debug({ repoOwner, repoName }, 'Skipping CSV file write in production');
    return '';
  }

  const outputDir = path.join(
    process.cwd(),
    'estimation-results',
    `${repoOwner}_${repoName}`
  );

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `estimations.csv`;
  const filepath = path.join(outputDir, filename);

  const csvContent = convertEstimationsToCSV(estimations);
  fs.writeFileSync(filepath, csvContent);

  logger.info({ filepath, count: estimations.length }, 'Wrote CSV estimations to file');
  return filepath;
}
