import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import {
  EnrichedIssue,
  RepoContext,
  formatRepoContextSummary,
  formatIssueSummary,
} from './github';

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
 * Generate the system prompt for issue estimation
 */
function generateSystemPrompt(params: EstimationParams): string {
  return `You are an expert software engineering project manager specializing in cost estimation for software development tasks.
Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.

Your task is to analyze GitHub issues and estimate their complexity and development cost based on these factors:
- Issue description and technical requirements
- Number and content of comments
- Labels (e.g., bug, feature, enhancement, documentation)
- Technical keywords and scope indicators
- Repository context (languages used, repository size, test coverage)

**Complexity Categories**

- **Low**: Simple bug fixes, minor text changes, documentation updates, configuration tweaks
- **Medium**: Feature enhancements, moderate refactoring, standard API integrations, UI improvements
- **High**: New major features, complex integrations, architectural changes, performance optimization
- **Complex**: Large-scale refactoring, security overhauls, complete system redesigns, complex distributed systems

**Inputs**
- ${params.minBudget}: (number): Minimum budget in US Dollar for cost estimation (required; must be less than or equal to maxBudget)
- ${params.maxBudget}: (number): Maximum budget in US Dollar for cost estimation (required; must be greater than or equal to minBudget)

If any required GitHub issue data is missing (such as absent labels, empty repository context, 
or incomplete issue description), include this in your reasoning, estimate based on the available data, 
and state any limitations.

After forming your estimation, check that all required fields are present 
and JSON keys are ordered as follows: "complexity", "estimatedCost", "reasoning".

Respond only in valid JSON format as specified below.

## Output Format
{
"complexity": "low" | "medium" | "high" | "critical",
"estimatedCost": number, // US Dollar
"reasoning": "Brief explanation of the estimation (2-3 sentences)"
}

If there is an error, respond with:
{
"error": "Explanation of the error."
}


`
;
}

/**
 * Generate the user prompt with issue and repo context
 */
function generateUserPrompt(
  repoContext: RepoContext,
  issue: EnrichedIssue
): string {
  return `**Repository Context:**
${formatRepoContextSummary(repoContext)}

---

**Issue to Estimate:**
${formatIssueSummary(issue)}

---

Based on the repository context and issue details above, provide your complexity assessment and cost estimation in JSON format.`;
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
