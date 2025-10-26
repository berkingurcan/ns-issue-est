## What

A tool that scans a GitHub repository and automatically creates a CSV estimating task costs for each issue. It helps us see which issues are worth turning into tasks and how much budget to allocate to each.
### Deliverables

    A GitHub repository containing the full source code for the Issue Estimator
    A hosted web app link (for example, Vercel) in the README.md
    A simple interface where I can enter any GitHub repo URL and download the generated CSV

## How

You enter a GitHub repo URL (for example, https://github.com/org/project), and the tool:

    Connects to the GitHub API.
    Fetches all open issues.
    Uses AI to analyze each issue’s description, labels, and comments to estimate complexity and assign a task cost (for example, $100–$1000).
    Outputs a CSV file containing:

issue_number title complexity estimated_cost labels url

Each row should include the direct GitHub link to the issue.

## Why

We want to easily go from issue to task and know how much to price each one.
