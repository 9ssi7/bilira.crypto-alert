compose:
	cd deployments && docker compose up -d --build

install:
	cd apps/history-generator && npm install
	cd apps/backend && npm install

prepare:
	cp .env.example .env

.PHONY: compose install prepare
