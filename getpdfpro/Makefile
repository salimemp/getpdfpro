.PHONY: help dev-up dev-down dev-api dev-web dev-mobile dev-worker \
        install install-api install-web install-mobile install-workers \
        test test-api test-web test-mobile lint format clean \
        deploy-web deploy-api deploy-workers logs-api logs-worker

help:  ## Show this help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ─────────────────────────────────────────────────────────────────
# Infrastructure
# ─────────────────────────────────────────────────────────────────
dev-up:  ## Start local infrastructure (Postgres, Redis, Mailhog)
	docker compose up -d postgres redis mailhog
	@echo "Waiting for services..."
	@sleep 3
	@echo "✓ Postgres: localhost:5432"
	@echo "✓ Redis: localhost:6379"
	@echo "✓ Mailhog UI: http://localhost:8025"

dev-down:  ## Stop local infrastructure
	docker compose down

# ─────────────────────────────────────────────────────────────────
# Local dev servers
# ─────────────────────────────────────────────────────────────────
dev-api:  ## Run FastAPI with hot reload
	cd apps/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:  ## Run Next.js with hot reload
	cd apps/web && npm run dev

dev-mobile:  ## Run Flutter app (auto-detects device)
	cd apps/mobile && flutter run

dev-worker:  ## Run Celery worker
	cd apps/workers && celery -A app.celery_app worker --loglevel=info

dev-beat:  ## Run Celery beat scheduler
	cd apps/workers && celery -A app.celery_app beat --loglevel=info

# ─────────────────────────────────────────────────────────────────
# Install
# ─────────────────────────────────────────────────────────────────
install: install-api install-web install-workers  ## Install all dependencies

install-api:
	cd apps/api && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

install-web:
	cd apps/web && npm install

install-mobile:
	cd apps/mobile && flutter pub get

install-workers:
	cd apps/workers && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

# ─────────────────────────────────────────────────────────────────
# Test
# ─────────────────────────────────────────────────────────────────
test: test-api test-web  ## Run all tests

test-api:
	cd apps/api && pytest -v

test-web:
	cd apps/web && npm run test

test-mobile:
	cd apps/mobile && flutter test

# ─────────────────────────────────────────────────────────────────
# Quality
# ─────────────────────────────────────────────────────────────────
lint:  ## Lint everything
	cd apps/api && ruff check .
	cd apps/web && npm run lint
	cd apps/mobile && flutter analyze

format:  ## Format everything
	cd apps/api && ruff format .
	cd apps/web && npm run format

# ─────────────────────────────────────────────────────────────────
# Deploy
# ─────────────────────────────────────────────────────────────────
deploy-web:  ## Deploy web to Vercel
	cd apps/web && vercel --prod

deploy-api:  ## Deploy API to Railway
	railway up --service getpdfpro-api

deploy-workers:  ## Deploy workers to Railway
	railway up --service getpdfpro-workers

# ─────────────────────────────────────────────────────────────────
# Logs
# ─────────────────────────────────────────────────────────────────
logs-api:
	railway logs --service getpdfpro-api

logs-worker:
	railway logs --service getpdfpro-workers

# ─────────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────────
clean:  ## Clean build artifacts
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null
	find . -type d -name "build" -exec rm -rf {} + 2>/dev/null
	find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null
	rm -f *.log
	@echo "✓ Cleaned"
