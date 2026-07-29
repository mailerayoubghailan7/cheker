# Email Subject Triage AI

An AI-powered web application that analyzes email subject lines and automatically groups them into categories. Built with a glassmorphism UI, dark/light themes, and deployed on Vercel.

## Features

- **AI-Powered Categorization** using OpenAI Responses API
- **Bulk Analysis** of up to 2,000 email subjects at once
- **Smart Categories**: Urgent, Work, Newsletters, Notifications, Personal, Finance, Shopping, Travel, Security, Promotions, Updates, Other
- **File Import**: TXT, CSV, JSON with drag-and-drop support
- **Live Search** across categories and subjects
- **4 Download Formats**: JSON, TXT, CSV, Markdown
- **Dark/Light Mode** with system preference detection
- **Glassmorphism UI** with animated loading
- **LocalStorage Persistence** for subjects and results
- **Keyboard Shortcuts**: Ctrl+Enter (analyze), Ctrl+D (theme)
- **Rate Limiting** and input validation on the backend
- **Fully Responsive** across all devices

## Tech Stack

| Layer    | Technology               |
|----------|--------------------------|
| Frontend | HTML5, CSS3, Vanilla JS  |
| Backend  | Python 3.12, FastAPI     |
| AI       | OpenAI Responses API     |
| Deploy   | Vercel Serverless        |

## Quick Deploy

### 1. Clone

```bash
git clone <your-repo-url>
cd email-subject-triage-ai
```

### 2. Set Environment Variable

In Vercel dashboard: **Settings > Environment Variables**

```
GROQ_API_KEY=gsk_your-key-here
```

### 3. Deploy

```bash
npx vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

## API

### `POST /api/analyze`

**Request:**
```json
{
  "subjects": [
    "Weekly Report",
    "Invoice #5521",
    "Security Alert"
  ]
}
```

**Response:**
```json
{
  "summary": "Your inbox contains a mix of work reports, financial documents, and security notifications.",
  "categories": [
    {
      "name": "Work",
      "subjects": ["Weekly Report"]
    },
    {
      "name": "Finance",
      "subjects": ["Invoice #5521"]
    },
    {
      "name": "Security",
      "subjects": ["Security Alert"]
    }
  ],
  "count": 3
}
```

### `GET /api/health`

Returns API status.

## Keyboard Shortcuts

| Shortcut       | Action        |
|----------------|---------------|
| `Ctrl + Enter` | Analyze Inbox |
| `Ctrl + D`     | Toggle Theme  |
| `Escape`       | Clear Search  |

## Project Structure

```
/
├── public/
│   ├── index.html      # Dashboard UI
│   ├── style.css       # All styles
│   ├── app.js          # Frontend logic
│   └── assets/         # Static assets
├── api/
│   └── index.py        # FastAPI backend
├── requirements.txt    # Python dependencies
├── vercel.json         # Vercel configuration
├── .env.example        # Environment template
├── README.md
└── .gitignore
```

## License

MIT
