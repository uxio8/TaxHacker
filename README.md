<div align="center"><a name="readme-top"></a>

<img src="public/logo/512.png" alt="" width="320">

<br>

# LedgerFlow — self-hosted AI workspace for receipts and operations

</div>

LedgerFlow is a self-hosted accounting workspace designed for freelancers, indie hackers, and small businesses who want to save time and automate expense and income tracking using modern AI.

Upload photos of receipts, invoices, or PDFs, and LedgerFlow will automatically recognize and extract the important data you need for accounting: product names, amounts, items, dates, merchants, taxes, and save it into a structured Excel-like database. You can even create custom fields with your own AI prompts to extract any specific information you need.

The app features automatic currency conversion (including crypto) based on historical exchange rates from the transaction date. With built-in filtering, multi-project support, import/export capabilities, and custom categories, LedgerFlow simplifies reporting and makes tax filing a bit easier.

![Dashboard](public/landing/main-page.webp)

> \[!IMPORTANT]
>
> This project is still in early development. Use at your own risk! **Star us** to get notified about new features and bugfixes ⭐️

## ✨ Features

### `1` Analyze photos and invoices with AI

![Currency Conversion](public/landing/ai-scanner-big.webp)

Snap a photo of any receipt or upload an invoice PDF, and LedgerFlow will automatically recognize, extract, categorize, and store the information in a structured database.

- **Upload and organize your docs**: Store multiple documents in "unsorted" until you're ready to process them manually or with AI assistance
- **AI data extraction**: Use AI to automatically pull key information like dates, amounts, vendors, and line items
- **Auto-categorization**: Transactions are automatically sorted into relevant categories based on their content
- **Item splitting**: Extract individual items from invoices and split them into separate transactions when needed
- **Structured storage**: Everything gets saved in an organized database for easy filtering and retrieval
- **Customizable AI providers**: Choose from OpenAI, Google Gemini, Mistral, or Pool Cloud

LedgerFlow works with a wide variety of documents, including store receipts, restaurant bills, invoices, bank statements, letters, and even handwritten receipts. It handles any language and any currency with ease.

### `2` Multi-currency support with automatic conversion (even crypto!)

![Currency Conversion](public/landing/multi-currency.webp)

LedgerFlow automatically detects currencies in your documents and converts them to your base currency using historical exchange rates.

- **Foreight currency detection**: Automatically identify the currency used in any document
- **Historical rates**: Get conversion rates from the actual transaction date
- **All-world coverage**: Support for 170+ world currencies and 14 popular cryptocurrencies (BTC, ETH, LTC, DOT, and more)
- **Flexible input**: Manual entry is always available when you need more control

### `3` Organize your transactions using fully customizable categories, projects and fields

![Transactions Table](public/landing/transactions-big.webp)

Adapt LedgerFlow to your unique needs with unlimited customization options. Create custom fields, projects, and categories that better suit your specific needs, industry standards, or country.

- **Custom categories and projecst**: Create your own categories and projects to group your transactions in any convenient way
- **Custom fields**: You can create unlimited number of custom fields to extraxt more information from your invoices (it's like creating extra columns in Excel)
- **Full-text search**: Search through the actual content of recognized documents
- **Advanced filtering**: Find exactly what you need with search and filter options
- **AI-powered extraction**: Write your own prompts to extract any custom information from documents
- **Bulk operations**: Process multiple documents or transactions at once

### `4` Customize any LLM prompt. Even system ones

![Custom Categories](public/landing/custom-llm.webp)

Take full control of how LedgerFlow's AI processes your documents. Write custom AI prompts for fields, categories, and projects, or modify the built-in ones to match your specific needs.

- **Customizable system prompts**: Modify the general prompt template in settings to suit your business
- **Field or project-specific prompts**: Create custom extraction rules for your industry-specific documents
- **Full control**: Adjust field extraction priorities and naming conventions to match your workflow
- **Industry optimization**: Fine-tune the AI to understand your specific type of business documents
- **Full transparency**: Every aspect of the AI extraction process is under your control and can be changed right in settings

LedgerFlow is fully adaptable to your unique requirements, whether you need to extract emails, addresses, project codes, or any other custom information from your documents.

### `5` Flexible data filtering and export

![Data Export](public/landing/export.webp)

Once your documents are processed, easily view, filter, and export your complete transaction history exactly how you need it.

- **Advanced filtering**: Filter by date ranges, categories, projects, amounts, and any custom fields
- **Flexible exports**: Export filtered transactions to CSV with all attached documents included
- **Tax-ready reports**: Generate comprehensive reports for your accountant or tax advisor
- **Data portability**: Download complete data archives to migrate to other services—your data stays yours

### `6` Self-hosted mode for data privacy

![Self-hosting](docs/screenshots/exported_archive.png)

Keep complete control over your financial data with local storage and self-hosting options. LedgerFlow respects your privacy and gives you full ownership of your information.

- **Home server ready**: Host on your own infrastructure for maximum privacy and control
- **Docker native**: Simple setup with provided Docker containers and compose files
- **Data ownership**: Your financial documents never leaves your control
- **No vendor lock-in**: Export everything and migrate whenever you want
- **Transparent operations**: Full access to source code and complete operational transparency

## 🛳 Deployment and Self-hosting

LedgerFlow can be self-hosted on your own infrastructure for complete control over your data and application environment. AI extraction runs through asynchronous analysis jobs, so you need both the web app and the analysis worker.

```bash
cp .env.example .env
docker compose -f docker-compose.build.yml up --build
```

The Docker Compose setup includes:

- LedgerFlow application container
- Analysis worker container (`npm run worker:analysis`)
- PostgreSQL 17 database (or connect to your existing database)
- Automatic database migrations on startup
- Volume mounts for persistent data storage
- Production-ready configuration

For advanced setups, you can customize the Docker Compose configuration to fit your infrastructure. The provided compose files build from the local [Dockerfile](./Dockerfile) so the analysis worker has the source files and the `codex` CLI available.

Both compose files now publish PostgreSQL to the host as `localhost:${POSTGRES_PORT:-5432}`. This keeps local `next dev`, Prisma commands, and the analysis worker aligned with a typical `.env` like `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ledgerflow`. If `5432` is already taken on your machine, override it when starting the stack, for example:

```bash
POSTGRES_PORT=55432 docker compose up -d postgres
```

If you override `POSTGRES_PORT`, make sure your local `DATABASE_URL` points to the same host port.

Example custom configuration:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    env_file:
      - .env
    ports:
      - "7331:7331"
    environment:
      - UPLOAD_PATH=/app/data/uploads
      - DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ledgerflow
    volumes:
      - ./data:/app/data
    restart: unless-stopped
  analysis-worker:
    build:
      context: .
      dockerfile: Dockerfile
    env_file:
      - .env
    command: ["npm", "run", "worker:analysis"]
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ledgerflow
      - UPLOAD_PATH=/app/data/uploads
    volumes:
      - ./data:/app/data
    restart: unless-stopped
  postgres:
    image: postgres:17-alpine
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
```

When `SELF_HOSTED_MODE=true`, the instance no longer auto-logs the first visitor in. You must set `SELF_HOSTED_ADMIN_TOKEN` and use that token on the `/self-hosted` screen to unlock the app. On the first successful access, LedgerFlow now only asks for the admin token and base currency. AI providers are configured afterwards from Settings.

Pool Cloud is configured entirely through environment variables. When `POOL_CLOUD_URL`, `POOL_CLOUD_TOKEN`, and `POOL_CLOUD_SLUG` are present, the provider appears in LLM settings as an environment-managed option. No user-level API key is requested for it.

### Cheapest practical setup while you polish the product

If you want to use LedgerFlow yourself on desktop and mobile before spending money on a real VM, the supported cheap path is:

- run `postgres + cloudflared` in Docker and `app + analysis-worker` on your own machine
- keep `STORAGE_PROVIDER=local`
- expose it over HTTPS with `Cloudflare Tunnel`
- run a daily local backup with `npm run backup:local`

Optional tunnel override:

```bash
cp .env.tunnel.example .env.tunnel
cp .env.localdeploy.example .env.localdeploy
npm run local:start
```

Runtime control:

```bash
npm run local:status
npm run local:stop
```

Daily backup:

```bash
npm run backup:local
```

Install the daily macOS backup agent:

```bash
./scripts/install-backup-launchd.sh
launchctl list com.ledgerflow.backup-local
```

Operational runbook:

- [Cheap local deployment runbook](docs/superpowers/specs/2026-03-23-cheap-local-deploy-runbook.md)

### Environment Variables

Configure LedgerFlow for your specific needs with these environment variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `UPLOAD_PATH` | Yes | Local directory for file uploads and storage | `./data/uploads` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user@localhost:5432/ledgerflow` |
| `PORT` | No | Port to run the application on | `7331` (default) |
| `BASE_URL` | No | Base URL for the application | `http://localhost:7331` |
| `POSTGRES_PORT` | No, only for local Docker Compose | Host port published by the bundled PostgreSQL service | `5432` |
| `SELF_HOSTED_MODE` | No | Set to `true` to enable the self-hosted flow, custom API keys, and instance-level configuration | `true` |
| `SELF_HOSTED_ADMIN_TOKEN` | Yes when `SELF_HOSTED_MODE=true` | Shared secret required to unlock the self-hosted instance and complete first-time setup | `replace-with-a-long-random-string` |
| `DISABLE_SIGNUP` | No | Disable new user registration on your instance | `false` |
| `BETTER_AUTH_SECRET` | Yes | Secret key for authentication (minimum 16 characters) | `your-secure-random-key` |
| `POOL_CLOUD_URL` | No | Base URL for the Pool Cloud control plane | `https://pool.example.com` |
| `POOL_CLOUD_TOKEN` | No | Bearer token used to acquire and renew leases | `pc_...` |
| `POOL_CLOUD_SLUG` | No | Pool identifier to use for receipt analysis leases | `ledgerflow-main` |
| `POOL_CLOUD_CLIENT_INSTANCE_ID` | No | Stable instance identifier sent when acquiring leases | `ledgerflow-prod-1` |

You can also configure LLM provider settings in the application or via environment variables:

- **OpenAI**: `OPENAI_MODEL_NAME` and `OPENAI_API_KEY`
- **Google Gemini**: `GOOGLE_MODEL_NAME` and `GOOGLE_API_KEY`
- **Mistral**: `MISTRAL_MODEL_NAME` and `MISTRAL_API_KEY`
- **Pool Cloud**: `POOL_CLOUD_URL`, `POOL_CLOUD_TOKEN`, and `POOL_CLOUD_SLUG`

Important operational detail: AI analysis now depends on the background worker for every provider, including direct API-key providers. If the worker is not running, analysis jobs stay queued and the UI will eventually time out.

## ⌨️ Local Development

We use:

- **Next.js 15+** for the frontend and API
- **Prisma** for database models and migrations
- **PostgreSQL** as the database (PostgreSQL 17+ recommended)
- **Ghostscript and GraphicsMagick** for PDF processing (install on macOS via `brew install gs graphicsmagick`)

Set up your local development environment:

```bash
# Clone the repository
git clone <your-fork-url>
cd ledgerflow

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Edit .env with your configuration
# Make sure to set DATABASE_URL to your PostgreSQL connection string
# Example: postgresql://user@localhost:5432/ledgerflow

# Initialize the database
npx prisma generate && npx prisma migrate dev

# Start the application and the analysis worker in separate terminals
npm run dev
npm run worker:analysis
```

Visit `http://localhost:7331` to see your local LedgerFlow instance in action.

For local Pool Cloud usage, also set `POOL_CLOUD_URL`, `POOL_CLOUD_TOKEN`, and `POOL_CLOUD_SLUG` in `.env`. The worker acquires a lease, downloads an `auth.json` snapshot, runs `codex exec`, renews the lease while it is busy, and completes or releases the lease when done.

AI analysis currently supports images and PDFs. Office files (`.doc`, `.docx`, `.xls`, `.xlsx`) can still be uploaded, but they are blocked from AI analysis until there is a real conversion pipeline.

For a production build, instead of `npm run dev` use the following commands:

```bash
# Build the application
npm run build

# Start the production server
npm run start
```

## 🤝 Contributing

We welcome contributions to LedgerFlow. Here's how you can help make it even better:

- **🐛 Bug Reports**: File detailed issues when you encounter problems
- **💡 Feature Requests**: Share your ideas for new features and improvements
- **🔧 Code Contributions**: Submit pull requests to improve the application
- **📚 Documentation**: Help improve documentation and guides
- **🎥 Content Creation**: Videos, tutorials, and reviews help us reach more users!

All development happens on GitHub through issues and pull requests. We appreciate any help.

## 📄 License

LedgerFlow is licensed under the [MIT License](LICENSE).
