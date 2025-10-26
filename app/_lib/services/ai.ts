import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { EnrichedIssue, RepoContext } from './github';
import { generateSystemPrompt, generateUserPrompt } from './prompts';

export interface IssueEstimation {
  issueNumber: number;
  title: string;
  complexity: 'low' | 'medium' | 'high' | 'critical';
  estimatedCost: number;
  reasoning: string;
  labels: string[];
  url: string;
}

export interface EstimationParams {
  minBudget: number;
  maxBudget: number;
  model: string;
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
    console.log(
      `[AI] Estimating issue #${issue.number}: ${issue.title.substring(0, 50)}...`
    );

    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
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

    // Log the estimation result
    console.log(
      `[AI] Issue #${issue.number} | Complexity: ${estimation.complexity} | Cost: $${estimation.estimatedCost} | Duration: ${duration}ms`
    );
    console.log(`[AI] Reasoning: ${estimation.reasoning}`);

    // Log token usage if available
    if (completion.usage) {
      console.log(
        `[AI] Tokens - Prompt: ${completion.usage.prompt_tokens} | Completion: ${completion.usage.completion_tokens} | Total: ${completion.usage.total_tokens}`
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
    console.error(`[AI] Error estimating issue #${issue.number}:`, error);
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

  console.log(
    `[AI Batch] Starting batch estimation of ${issues.length} issues (batch size: ${batchSize})`
  );
  const batchStartTime = Date.now();

  for (let i = 0; i < issues.length; i += batchSize) {
    const batch = issues.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(issues.length / batchSize);

    console.log(
      `[AI Batch] Processing batch ${batchNumber}/${totalBatches} (issues ${i + 1}-${Math.min(i + batchSize, issues.length)})`
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

    console.log(
      `[AI Batch] Completed batch ${batchNumber}/${totalBatches} (${currentCount}/${issues.length} total)`
    );
  }

  const totalDuration = Date.now() - batchStartTime;
  console.log(
    `[AI Batch] Completed all estimations in ${(totalDuration / 1000).toFixed(2)}s`
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
  console.log(`[AI] Wrote estimation to file: ${filepath}`);
}
