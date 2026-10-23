
# AEGIS — Enterprise Operations Intelligence

AEGIS is a local-first operations intelligence project designed to investigate business incidents, correlate operational evidence, and identify possible causes of operational problems.

## Current capabilities

- Incident tracking backed by PostgreSQL and Prisma.
- Investigation APIs for related incidents and hypotheses.
- Evidence-based analysis with observed facts, missing information, and cautious conclusions.
- Optional local AI analysis through Ollama.
- Automated tests for investigation logic, evidence handling, and API validation.
- Synthetic demo data for development and testing.

Analysis results are decision-support leads, not proof of a root cause. Validate findings against real business evidence before taking action.

## Requirements

- Node.js and npm.
- Docker with PostgreSQL, or another accessible PostgreSQL instance.
- Ollama and the configured local model for local AI analysis.

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Configure `DATABASE_URL` in a local `.env` file. Never commit credentials or real company data.

3. Apply the existing database migrations and generate the Prisma client:

   ```powershell
   npx prisma migrate deploy
   npx prisma generate
   ```

4. Optionally seed the database with fictional demo branches and incidents:

   ```powershell
   node .\prisma\seed.mjs
   ```

   Review the target database before running the seed script.

5. Start the development server:

   ```powershell
   npm run dev
   ```

   Open http://localhost:3000.

## Quality checks

```powershell
npm run lint
npx tsc --noEmit
npm run build
node --experimental-strip-types --test .\tests\investigation-engine.test.ts .\tests\evidence-investigation.test.ts .\tests\northstar-benchmark.test.ts .\tests\evidence-api-validation.test.ts
```

## Security and data integrity

- Keep environment files, credentials, API keys, and production data out of version control.
- Use synthetic data for development and automated tests.
- Do not treat correlation scores or AI-generated hypotheses as verified causation.
- Validate findings before using them for operational decisions.

## Project status

AEGIS is under active local development. Production deployment, real enterprise integrations, and validation against authorized real-world datasets remain future milestones.
