.PHONY: help install dev dev-web dev-agent build clean

NEXT_APP := next-app
AGENT_SERVICE := agent-service

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies for both services
	cd $(AGENT_SERVICE) && npm install
	cd $(NEXT_APP) && npm install

dev: ## Run both services (agent-service :2024 + next-app :3000)
	@echo "Starting agent-service (:2024) and next-app (:3000). Ctrl-C to stop both."
	@trap 'kill 0' INT TERM EXIT; \
		$(MAKE) --no-print-directory dev-agent & \
		$(MAKE) --no-print-directory dev-web & \
		wait

dev-agent: ## Run only the LangGraph agent service
	cd $(AGENT_SERVICE) && npm run dev

dev-web: ## Run only the Next.js app
	cd $(NEXT_APP) && npm run dev

build: ## Build both services
	cd $(AGENT_SERVICE) && npm run build
	cd $(NEXT_APP) && npm run build
