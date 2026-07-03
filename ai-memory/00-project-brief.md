# 00 — Project Brief (Orchestrator)

## Ce construim
Un idle game browser-based, production-grade, numit **Fable Idler** (numele folderului de proiect), livrat complet prin Docker. Utilizatorul NU are Node.js instalat pe host — orice comandă de build/test/rulare trebuie să funcționeze exclusiv prin Docker / Docker Compose.

## Decizii luate de orchestrator (fixe, nu se renegociază)
- **Platformă:** aplicație browser (SPA), fără backend — persistență în `localStorage` + offline progress calculat din timestamp. Motiv: cel mai simplu de rulat prin Docker, testabil cu Playwright, zero dependințe host.
- **Stack:** React 18 + TypeScript + Vite. Motor de joc = **modul TypeScript pur, separat de UI** (`src/engine/`), testabil cu Vitest fără DOM. UI-ul doar randează starea și trimite acțiuni.
- **Teste:** Vitest (unit — economie, generatori, upgrade-uri, prestige, save/load, offline) + Playwright (E2E — flow complet) — ambele rulate în containere.
- **Producție:** multi-stage Dockerfile (node:22 build → nginx serve). `docker compose up --build` → joc pe `http://localhost:8080`.
- **Dev:** serviciu compose separat cu Vite dev server (port 5173), opțional.
- **Temă sugerată (agentul de design decide detaliile):** potrivit numelui "Fable Idler" — jucătorul este un Țesător de Fabule / Fable Weaver; tema trebuie să fie coerentă, nu generică.

## Mediu verificat (2026-07-03)
- Windows 11, Docker Desktop 28.0.1, Compose v2.33.1 — daemon funcțional (verificat cu `docker info`).
- Node/npm absente pe host (confirmat) → toate comenzile npm rulează în containere `node:22-alpine`.
- Directorul de proiect era gol la start. Nu este repo git.

## Cerințe minime funcționale (din cerința clientului — obligatorii)
- 1 resursă principală generată idle + acțiune activă (click).
- ≥5 upgrade-uri distincte, ≥5 generatori automați distincți.
- ≥10 achievements, ≥10 milestones/unlock-uri.
- ≥1 sistem de prestige cu impact real în economie.
- Offline progress, salvare automată, reset controlat cu protecție (confirmare + export/import save).
- UI modern, responsive, polished: dashboard resursă, zonă click, liste upgrade/generatori, achievements, milestones, prestige, indicatori /sec, feedback vizual la cumpărare/unlock.
- Fără erori critice în consolă; fără pierdere de date la refresh.

## Plan de execuție (faze + agenți)
1. **Design** — Agent 1 (Game Design) → `01-game-design.md`; apoi în paralel Agent 2 (Economy) → `03-economy-balance.md`, Agent 3 (Arhitectură) → `02-technical-architecture.md`, Agent 4 (UI/UX) → `04-ui-ux-decisions.md`.
2. **Schelet proiect** — orchestratorul scrie package.json/tsconfig/vite/Docker skeleton; `npm install` prin container.
3. **Implementare** — Agent 5 (engine + unit tests), Agent 6 (prestige, integrat în engine), Agent UI (interfața conform 04), Agent 7 (Docker/DevOps final + README), Agent 8 (Playwright E2E). Log în `05-implementation-log.md`.
4. **Validare** — build + teste rulate real prin Docker; bug-fixing loop documentat în `07-bugs-and-fixes.md`.
5. **Quality gate** — Agent 9: review multi-lens + raport `08-final-validation.md`.

## Convenții de memorie
Fiecare agent scrie/actualizează fișierul lui din `/ai-memory` cu: ce s-a decis, de ce, fișiere create/modificate, riscuri, ce trebuie să știe următorul agent, validări făcute. Orchestratorul verifică după fiecare fază.

## Riscuri identificate la start
- Bind mount Windows + node_modules = lent → folosim named volume pentru node_modules în compose.
- Playwright are nevoie de browsere → folosim imaginea oficială `mcr.microsoft.com/playwright` versionată identic cu pachetul npm.
- Economia trebuie validată numeric (unit tests pe formule), nu doar „pare ok".
