# GitHub Issue Estimator

An AI-powered tool that automatically analyzes GitHub issues and estimates their implementation costs based on complexity, helping teams make informed decisions about task prioritization and budget allocation.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Demo](#demo)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [CSV Output Format](#csv-output-format)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

GitHub Issue Estimator scans GitHub repositories and automatically generates cost estimates for each open issue using advanced AI analysis. It processes issue descriptions, comments, labels, and repository context to determine complexity levels and assign budget estimates.

### Key Benefits

- **Automated Analysis**: No manual estimation needed - AI analyzes each issue comprehensively
- **Dual Mode**: Estimate entire repositories or individual issues
- **Budget Flexibility**: Configure overall or complexity-specific budget ranges
- **Real-time Progress**: Live streaming updates during batch processing
- **Export Ready**: Download results as CSV for easy integration with project management tools

## ✨ Features

### Repository Analysis
- Fetch and analyze all open issues from any public GitHub repository
- Batch processing with real-time progress tracking
- Server-sent events (SSE) for live status updates
- Comprehensive repository context analysis

### Single Issue Estimation
- Analyze individual issues by URL
- Quick estimates for specific tasks
- Same AI-powered analysis as batch mode

### AI-Powered Estimation
- Uses OpenAI GPT models for intelligent analysis
- Multiple model options (GPT-5, GPT-5 Mini, GPT-5 Nano, GPT-4.1)
- Considers:
  - Issue description and technical complexity
  - Comments and discussions
  - Labels and metadata
  - Repository context (languages, size, test coverage)
  - Historical patterns

### Flexible Budget Configuration
- **Overall Budget Range**: Set min/max for all issues
- **Complexity-Specific Budgets**: Optional granular control
  - Low: Simple fixes, documentation, minor tweaks
  - Medium: Enhancements, integrations, UI work
  - High: Major features, architectural changes
  - Critical: System overhauls, redesigns, distributed systems

### Export & Results
- CSV download with detailed estimation data
- Status logs for debugging and transparency
- Saved outputs to `llm-outputs/` directory
- Structured JSON data available

## 🚀 Demo

**Hosted App**: [https://ns-issue-est.vercel.app/](https://ns-issue-est.vercel.app/)

## 🏁 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- GitHub Personal Access Token
- OpenAI API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ns-issue-est.git
   cd ns-issue-est
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**

   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your API keys:
   ```env
   # GitHub API Configuration
   GITHUB_TOKEN=ghp_your_github_personal_access_token_here

   # OpenAI API Configuration
   OPENAI_API_KEY=sk-your_openai_api_key_here
   ```

   **Getting API Keys:**

   - **GitHub Token**: Go to [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens) and generate a new token with `repo` scope
   - **OpenAI API Key**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser

## 📖 Usage Guide

### Analyzing a Repository

1. **Select AI Model**: Choose your preferred OpenAI model from the dropdown
   - **GPT-5**: Most capable, highest cost
   - **GPT-5 Mini**: Balanced performance and cost
   - **GPT-5 Nano**: Fastest, most economical (default)
   - **GPT-4.1**: Previous generation

2. **Set Budget Range**: Configure your budget parameters
   - **Overall Budget**: Set minimum and maximum cost range (e.g., $100 - $10,000)
   - **Optional Complexity Budgets**: Expand the accordion to set specific ranges for each complexity level

3. **Enter Repository URL**: Paste the GitHub repository URL
   ```
   github.com/owner/repository
   ```
   Supported formats:
   - `github.com/owner/repo`
   - `https://github.com/owner/repo`
   - `https://github.com/owner/repo.git`

4. **Submit**: Click the "Submit" button under the repository input

5. **Monitor Progress**: Watch real-time logs as the system:
   - Parses repository URL
   - Fetches repository context
   - Loads open issues
   - Enriches issue data with comments
   - Processes AI estimations in batches

6. **Download Results**: Once complete, click the "DOWNLOAD" button to get your CSV file

### Analyzing a Single Issue

1. **Configure Model & Budget**: Same as repository analysis

2. **Enter Issue URL**: Paste the GitHub issue URL
   ```
   github.com/owner/repository/issues/123
   ```

3. **Submit**: Click the "Submit" button under the issue input

4. **View Results**: See estimation details in the status log:
   - Issue number and title
   - Complexity level
   - Estimated cost
   - AI reasoning

## 🔌 API Documentation

### POST `/api/estimate-repo-issues`

Analyzes all open issues in a repository.

**Request Body:**
```json
{
  "repoLink": "github.com/owner/repo",
  "minBudget": 100,
  "maxBudget": 10000,
  "model": "gpt-5-nano",
  "stream": true,
  "lowMin": 100,
  "lowMax": 300,
  "mediumMin": 300,
  "mediumMax": 600,
  "highMin": 600,
  "highMax": 1000,
  "criticalMin": 1000,
  "criticalMax": 10000
}
```

**Parameters:**
- `repoLink` (required): GitHub repository URL
- `minBudget` (optional): Overall minimum budget
- `maxBudget` (optional): Overall maximum budget
- `model` (optional): OpenAI model to use (default: `gpt-5-nano`)
- `stream` (optional): Enable server-sent events (default: `false`)
- `lowMin`, `lowMax`, etc. (optional): Complexity-specific budget ranges

**Response (with streaming):**
Server-sent events with the following event types:
```
data: {"type": "log", "message": "> PARSING REPOSITORY URL..."}
data: {"type": "log", "message": "> FOUND 25 ISSUES"}
data: {"type": "complete", "message": "> READY FOR DOWNLOAD", "data": {...}}
data: {"type": "error", "message": "Error description"}
```

**Response (without streaming):**
```json
{
  "success": true,
  "repository": {
    "owner": "owner",
    "repo": "repo"
  },
  "totalIssues": 25,
  "processedIssues": 25,
  "estimations": [...],
  "csvContent": "...",
  "summary": {
    "totalCost": 12500,
    "avgCost": 500,
    "complexityCounts": {
      "low": 10,
      "medium": 8,
      "high": 5,
      "critical": 2
    }
  }
}
```

### POST `/api/estimate-issue`

Analyzes a single GitHub issue.

**Request Body:**
```json
{
  "issueLink": "github.com/owner/repo/issues/123",
  "minBudget": 100,
  "maxBudget": 10000,
  "model": "gpt-5-nano",
  "lowMin": 100,
  "lowMax": 300,
  "mediumMin": 300,
  "mediumMax": 600,
  "highMin": 600,
  "highMax": 1000,
  "criticalMin": 1000,
  "criticalMax": 10000
}
```

**Response:**
```json
{
  "success": true,
  "repository": {
    "owner": "owner",
    "repo": "repo"
  },
  "estimation": {
    "issueNumber": 123,
    "title": "Add user authentication",
    "complexity": "high",
    "estimatedCost": 750,
    "reasoning": "Complex feature requiring security implementation...",
    "labels": ["feature", "security"],
    "url": "https://github.com/owner/repo/issues/123"
  }
}
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token for API access |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI estimations |
| `NODE_ENV` | No | Environment mode (development/production) |
| `PORT` | No | Server port (default: 3000) |
| `LOG_LEVEL` | No | Logging level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` (default: `info`) |

### Logging

The application uses [Pino](https://getpino.io/) for structured logging with the following features:

- **Structured JSON Logs**: All logs include contextual data as JSON objects
- **Configurable Log Levels**: Set via `LOG_LEVEL` environment variable
- **Server-side Only**: Logging is configured for Node.js server environment
- **Performance**: Pino is one of the fastest Node.js loggers

**Log Levels (from most to least verbose):**
- `trace`: Very detailed debugging information
- `debug`: Detailed debugging information (LLM prompts, token usage)
- `info`: General informational messages (default)
- `warn`: Warning messages
- `error`: Error messages
- `fatal`: Critical errors that cause application failure

**Example log output:**
```json
{"level":"info","time":1234567890,"owner":"facebook","repo":"react","msg":"Fetching repository context"}
{"level":"info","time":1234567891,"totalIssues":25,"msg":"Total open issues fetched"}
```

### Budget Configuration

The system supports two budget configuration modes:

#### 1. Overall Budget (Simple)
Set a single min/max range that will be automatically distributed across complexity levels:
```json
{
  "minBudget": 100,
  "maxBudget": 10000
}
```

#### 2. Complexity-Specific Budgets (Advanced)
Define precise ranges for each complexity level:
```json
{
  "complexityBudgets": {
    "low": { "min": 100, "max": 300 },
    "medium": { "min": 300, "max": 600 },
    "high": { "min": 600, "max": 1000 },
    "critical": { "min": 1000, "max": 10000 }
  }
}
```

## 🏗️ Architecture

### Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **GitHub API**: Octokit
- **AI**: OpenAI SDK
- **Deployment**: Vercel

### Project Structure

```
ns-issue-est/
├── app/
│   ├── _lib/
│   │   └── services/
│   │       ├── github.ts      # GitHub API integration
│   │       ├── ai.ts          # AI estimation logic
│   │       └── prompts.ts     # AI prompt templates
│   ├── api/
│   │   ├── estimate-repo-issues/
│   │   │   └── route.ts       # Batch estimation endpoint
│   │   ├── estimate-issue/
│   │   │   └── route.ts       # Single issue endpoint
│   │   └── healthcheck/
│   │       └── route.ts       # Health check endpoint
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main UI page
├── llm-outputs/               # Saved estimation outputs
├── .env.example               # Environment template
└── README.md                  # This file
```

### Data Flow

#### Repository Analysis Flow
```
User Input (Repo URL + Config)
    ↓
Frontend (page.tsx)
    ↓
POST /api/estimate-repo-issues
    ↓
GitHub Service
  ├── Parse URL
  ├── Fetch repo context (languages, metadata)
  ├── Fetch all open issues (paginated)
  └── Enrich issues with comments
    ↓
AI Service
  ├── Batch issues (5 at a time)
  ├── Format prompts with context
  ├── Call OpenAI API
  └── Parse structured responses
    ↓
CSV Generation
    ↓
Stream progress updates (SSE)
    ↓
Return CSV + summary data
    ↓
Frontend displays results + download button
```

#### Single Issue Flow
```
User Input (Issue URL + Config)
    ↓
Frontend (page.tsx)
    ↓
POST /api/estimate-issue
    ↓
GitHub Service
  ├── Parse issue URL
  ├── Fetch specific issue
  ├── Fetch repo context
  └── Enrich with comments
    ↓
AI Service
  └── Estimate single issue
    ↓
Return estimation data
    ↓
Frontend displays results in logs
```

### AI Estimation Logic

The AI considers multiple factors when estimating:

1. **Issue Content Analysis**
   - Description length and technical depth
   - Code snippets or technical specifications
   - Acceptance criteria complexity

2. **Metadata Signals**
   - Labels (bug, feature, enhancement, documentation, etc.)
   - Number of comments (indicates discussion/complexity)
   - Issue age and update frequency

3. **Repository Context**
   - Primary programming languages
   - Repository size and maturity
   - Test coverage indicators
   - Technology stack (topics/tags)

4. **Complexity Classification**
   - **Low**: Documentation, typos, simple config changes, minor UI tweaks
   - **Medium**: Feature enhancements, integrations, moderate refactoring
   - **High**: New major features, architectural changes, security implementations
   - **Critical**: System redesigns, distributed systems, major overhauls

## 📊 CSV Output Format

The generated CSV includes the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| `issue_number` | GitHub issue number | 123 |
| `title` | Issue title | "Add user authentication" |
| `complexity` | Complexity level | "high" |
| `estimated_cost` | Cost estimate in USD | 750 |
| `labels` | Comma-separated labels | "feature,security" |
| `url` | Direct GitHub issue link | "https://github.com/..." |
| `reasoning` | AI explanation | "Complex feature requiring..." |

**Example CSV:**
```csv
issue_number,title,complexity,estimated_cost,labels,url,reasoning
1,Add user authentication,high,750,feature;security,https://github.com/owner/repo/issues/1,Complex feature requiring security implementation and database schema changes
2,Fix login button styling,low,150,bug;ui,https://github.com/owner/repo/issues/2,Simple CSS fix with minimal scope
3,Update API documentation,low,100,documentation,https://github.com/owner/repo/issues/3,Documentation update with clear scope
```

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/ns-issue-est.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/new)
   - Import your GitHub repository
   - Configure environment variables:
     - `GITHUB_TOKEN`
     - `OPENAI_API_KEY`

3. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy your app
   - You'll receive a production URL (e.g., `https://your-app.vercel.app`)

4. **Update README**
   - Add your deployed URL to the [Demo](#demo) section

### Manual Deployment

```bash
# Build the production application
npm run build

# Start the production server
npm start
```

## 🛠️ Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Format code with Prettier
npm run format

# Check code formatting
npm run format:check
```

### Code Formatting

This project uses Prettier for code formatting. Format your code before committing:

```bash
npm run format
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org)
- AI powered by [OpenAI](https://openai.com)
- GitHub API via [Octokit](https://github.com/octokit/octokit.js)

---

**Need Help?** Open an issue on GitHub or contact the maintainers.
