.PHONY: help dev dev-backend dev-frontend migrate migrate-docker up down logs ps build-backend build-frontend build lint test setup

GREEN  = \033[0;32m
YELLOW = \033[0;33m
NC     = \033[0m

help: ## print all available commands with descriptions
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2} /^## / {printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 4)}' $(MAKEFILE_LIST)

## Development (native)

dev: ## start backend + frontend concurrently
	@$(MAKE) -j 2 dev-backend dev-frontend

dev-backend: ## start backend only (go run ./cmd/api)
	@echo "$(GREEN)Starting backend...$(NC)"
	cd backend && go run ./cmd/api

dev-frontend: ## start frontend only (npm run dev)
	@echo "$(GREEN)Starting frontend...$(NC)"
	cd frontend && npm run dev

## Migrations

migrate: ## run all migrations in order against DATABASE_DSN
	@if [ -z "$$DATABASE_DSN" ]; then \
		echo "$(YELLOW)Error: DATABASE_DSN is not set$(NC)"; \
		exit 1; \
	fi
	@bash scripts/migrate.sh

migrate-docker: ## run migrations inside running backend container
	@echo "$(GREEN)Running migrations in Docker...$(NC)"
	@if [ -z "$$DATABASE_DSN" ]; then \
		echo "$(YELLOW)Error: DATABASE_DSN is not set$(NC)"; \
		exit 1; \
	fi
	docker compose exec -e DATABASE_DSN="$$DATABASE_DSN" backend sh -c "apk update && apk add --no-cache bash postgresql-client && bash scripts/migrate.sh"

## Docker

up: ## docker compose up --build -d
	docker compose up --build -d

down: ## docker compose down
	docker compose down

logs: ## docker compose logs -f
	docker compose logs -f

ps: ## docker compose ps
	docker compose ps

## Build

build-backend: ## go build ./...
	@echo "$(GREEN)Building backend...$(NC)"
	cd backend && go build ./...

build-frontend: ## npm run build (inside frontend/)
	@echo "$(GREEN)Building frontend...$(NC)"
	cd frontend && npm run build

build: build-backend build-frontend ## build-backend + build-frontend

## Quality

lint: ## go vet ./... inside backend/
	@echo "$(GREEN)Linting backend...$(NC)"
	cd backend && go vet ./...

test: ## go test ./... inside backend/
	@echo "$(GREEN)Testing backend...$(NC)"
	cd backend && go test ./...

## Setup

setup: ## copy .env.example to .env if missing
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)Created .env from .env.example.$(NC)"; \
		echo "$(YELLOW)Please fill in .env before running make dev.$(NC)"; \
	else \
		echo "$(GREEN).env already exists.$(NC)"; \
	fi
