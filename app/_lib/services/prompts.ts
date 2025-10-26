import { EstimationParams } from './ai';
import { EnrichedIssue, RepoContext, formatRepoContextSummary, formatIssueSummary } from './github';

/**
 * Generate the system prompt for issue estimation
 */
export function generateSystemPrompt(params: EstimationParams): string {
  // Calculate budget ranges - use custom ranges if provided, otherwise divide equally
  const calculateBudgetRanges = () => {
    if (params.complexityBudgets?.low && params.complexityBudgets?.medium &&
        params.complexityBudgets?.high && params.complexityBudgets?.critical) {
      return {
        low: params.complexityBudgets.low,
        medium: params.complexityBudgets.medium,
        high: params.complexityBudgets.high,
        critical: params.complexityBudgets.critical,
      };
    }

    // Fallback: divide equally
    const range = params.maxBudget - params.minBudget;
    return {
      low: {
        min: params.minBudget,
        max: Math.round(params.minBudget + range * 0.25)
      },
      medium: {
        min: Math.round(params.minBudget + range * 0.25),
        max: Math.round(params.minBudget + range * 0.6)
      },
      high: {
        min: Math.round(params.minBudget + range * 0.6),
        max: Math.round(params.minBudget + range * 0.85)
      },
      critical: {
        min: Math.round(params.minBudget + range * 0.85),
        max: params.maxBudget
      },
    };
  };

  const budgetRanges = calculateBudgetRanges();

  return `You are an expert software engineering project manager specializing in cost estimation for software development tasks.

Your task is to analyze GitHub issues and estimate their complexity and development cost based on these factors:
- Issue description and technical requirements
- Number and content of comments
- Labels (e.g., bug, feature, enhancement, documentation)
- Technical keywords and scope indicators
- Repository context (languages used, repository size, test coverage)

**Complexity Categories and Budget Ranges**

Estimate the cost according to these complexity levels:

- **Low**: Simple bug fixes, minor text changes, documentation updates, configuration tweaks
  Budget Range: $${budgetRanges.low.min} - $${budgetRanges.low.max} USD

- **Medium**: Feature enhancements, moderate refactoring, standard API integrations, UI improvements
  Budget Range: $${budgetRanges.medium.min} - $${budgetRanges.medium.max} USD

- **High**: New major features, complex integrations, architectural changes, performance optimization
  Budget Range: $${budgetRanges.high.min} - $${budgetRanges.high.max} USD

- **Critical**: Large-scale refactoring, security overhauls, complete system redesigns, complex distributed systems
  Budget Range: $${budgetRanges.critical.min} - $${budgetRanges.critical.max} USD

**Instructions**

1. Carefully analyze the issue details and repository context
2. Determine the appropriate complexity category
3. Calculate a specific cost estimate within the range for that complexity level
4. Be realistic about the cost estimation, consider the industry open source contribution standards
5. Be frugal. Consider the time and labour while estimating
6. Provide clear reasoning for your estimation (2-3 sentences)

The estimatedCost MUST be a specific number (not a range) within the appropriate complexity level's budget range.

If any required GitHub issue data is missing (such as absent labels, empty repository context,
or incomplete issue description), include this in your reasoning, estimate based on the available data,
and state any limitations.

Respond only in valid JSON format as specified below.

## Output Format
{
  "complexity": "low" | "medium" | "high" | "critical",
  "estimatedCost": number,
  "reasoning": "Brief explanation of the estimation (2-3 sentences)"
}

If there is an error, respond with:
{
  "error": "Explanation of the error."
}
`;
}

/**
 * Generate the user prompt with issue and repo context
 */
export function generateUserPrompt(
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
