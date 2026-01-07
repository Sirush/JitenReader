# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build              # Build for Chrome (default)
npm run build firefox      # Build for Firefox
npm run watch              # Watch mode with auto-rebuild
npm run lint               # ESLint on src/
npm run lint:fix           # Auto-fix linting issues
npm run lint:ff            # Firefox web-ext validation
npm run pack               # Pack extension for all targets → packages/
```

Build output goes to `jiten.reader/` directory. Load as unpacked extension in browser for testing.

Node.js 22.x required.

## Quick Reference

### Entry Points
- `src/apps/ajb.ts` - Content script (runs on all pages)
- `src/background-worker/background-worker.ts` - Service worker
- `src/views/widget.ts` - Extension popup
- `src/views/settings.ts` - Settings page

### Core Classes
- `src/apps/integration/registry.ts` - Central foreground state (Registry singleton)
- `src/apps/batches/batch-controller.ts` - Parsing pipeline orchestration
- `src/apps/parser/base.parser.ts` - Abstract parser base class
- `src/background-worker/parser/parser.ts` - Background text parser

### Configuration & Types
- `src/shared/configuration/types.ts` - ConfigurationSchema
- `src/shared/jiten/types.ts` - JitenCard, JitenToken, JitenCardState
- `src/shared/host-meta/types.ts` - HostMeta, PredefinedHostMeta

### Message Definitions
- `src/shared/messages/background/` - Commands to service worker
- `src/shared/messages/foreground/` - Commands to content scripts
- `src/shared/messages/broadcast/` - Commands to all contexts

## Architecture Overview

**JitenReader** is a Manifest V3 browser extension that parses Japanese text using Jiten.moe. Supports Chrome (v116+) and Firefox (v126+).

### Multi-Process Architecture

```
Browser Extension:
├── Service Worker (Background)     → src/background-worker/background-worker.ts
├── Content Scripts                 → src/apps/ajb.ts (injected into all frames)
├── Popup UI                        → src/views/widget.ts
├── Settings Page                   → src/views/settings.ts
└── Shared Libraries                → src/shared/ (common code for all contexts)
```

### Key Directories

**src/apps/** - Content script applications (foreground context)
- `ajb.ts` - Main entry, initialises parsers, popup, status bar, keybinds
- `parser/` - Parsing engines (see Parser System below)
- `popup/` - Popup UI manager and word display
- `integration/` - Registry, host evaluation, keybind manager, event delegation
- `text-highlighter/` - Word colouration and highlighting
- `batches/` - Batch text processing: paragraph extraction, token application
- `sequence/` - AbortableSequence for parse request management
- `paragraph-reader/` - DOM text extraction into Paragraph fragments
- `status-bar/` - Bottom status bar showing parse statistics

**src/background-worker/** - Service worker (background context)
- `jiten/` - Jiten API integration and deck management
- `parser/` - Japanese text parsing: Parser, ParseController, WorkerQueue
- `jiten-card-actions/` - Card state management (grade, forget, update)
- `lookup/` - Word lookup controller
- `lib/` - Command handler collection and registration

**src/shared/** - Shared code accessible from all contexts
- `messages/` - Message passing system (see Message System below)
- `configuration/` - User settings schema, get/set, profiles
- `jiten/` - Jiten API wrappers (parse, review, add/remove vocabulary)
- `anki/` - AnkiConnect API wrappers
- `host-meta/` - Host configuration and metadata
- `extension/` - Chrome/Firefox API wrappers (runtime, tabs, storage)
- `dom/` - DOM utilities (on, createElement, displayToast)

**src/views/** - HTML pages and controllers
- `widget.html/ts` - Popup UI
- `settings.html/ts` - Settings page
- `elements/` - Web Components (profile selector, keybind input, etc.)

**src/styles/** - SCSS stylesheets
- `theme/` - Reusable theme components

**scripts/** - Build tooling
- `webpack.mjs` - Webpack config (auto-discovers entry points)
- `transform-manifest.mjs` - Chrome↔Firefox manifest transform
- `build.mjs` - Build orchestrator

## Parser System

### Parser Hierarchy

```
BaseParser (abstract)
├── AutomaticParser - Parse on page load via observers
│   ├── MokuroParser - Mokuro manga reader
│   ├── MokuroLegacyParser - Legacy Mokuro support
│   ├── SatoriReaderParser - Satori Reader (desktop/mobile modes)
│   ├── BunproParser - BunPro grammar site
│   ├── AozoraParser - Aozora Bunko literature
│   ├── ReadwokParser - ReadWok
│   ├── TtsuParser - TTSU
│   └── ExStaticParser - Explainable Japanese Static
└── TriggerParser - Manual parsing via button/keybind
    └── NoParser - Disabled, shows error on parse attempt
```

Custom parsers: `src/apps/parser/custom-parsers/`
Factory: `src/apps/parser/get-custom-parser.ts`

### Parsing Flow

```
Content Script                    Service Worker
     │                                 │
     ├── Parser.parsePage()            │
     │      ↓                          │
     ├── BatchController               │
     │    .registerNodes()             │
     │      ↓                          │
     ├── getParagraphs()               │
     │    → Paragraph[]                │
     │      ↓                          │
     ├── ParseCommand.send() ─────────→├── ParseCommandHandler
     │                                 │      ↓
     │                                 ├── ParseController
     │                                 │    .queueParagraph()
     │                                 │      ↓
     │                                 ├── WorkerQueue
     │                                 │      ↓
     │                                 ├── Parser.parse()
     │                                 │    → Jiten API
     │                                 │      ↓
     ├←── SequenceSuccessCommand ──────┤
     │      ↓                          │
     └── applyTokens()                 │
          → DOM updated                │
```

## Registry (Foreground State)

`Registry` singleton in `src/apps/integration/registry.ts` holds all foreground state:

- `parsers: BaseParser[]` - Active parsers
- `batchController: BatchController` - Parsing pipeline
- `sequenceManager: SequenceManager` - Abortable sequences
- `sentenceManager: SentenceManager` - Sentence state tracking
- `hostEvaluator: HostEvaluator` - Host configuration resolver
- `wordEventDelegator: WordEventDelegator` - Click/hover delegation
- `events: EventCollection` - Custom event emitter
- `popupManager?: PopupManager` - Popup lifecycle
- `statusBar?: StatusBar` - Stats display
- `cards: Map<string, JitenCard>` - Card cache by `wordId/readingIndex`
- `textHighlighterOptions` - Highlighting configuration

## Message System

Commands extend base classes in `src/shared/messages/lib/`:
- `BackgroundCommand<Args, Result>` - Content → Service Worker (call/send)
- `ForegroundCommand<Args, Result>` - Service Worker → Content Script
- `BroadcastCommand<Args>` - Any → All contexts (fire-and-forget)

### Key Commands

**Background** (foreground → worker):
- `ParseCommand` - Parse text sequences
- `LookupTextCommand` - Look up word
- `FetchDecksCommand` - Fetch Jiten decks
- `GradeCardCommand` - Grade card review
- `ForgetCardCommand` - Forget/suspend card
- `UpdateCardStateCommand` - Refresh card state
- `AbortRequestCommand` - Cancel parse request
- `OpenSettingsCommand` - Open settings page

**Foreground** (worker → content):
- `SequenceSuccessCommand` - Return parsed tokens
- `SequenceErrorCommand` - Return parse error
- `SequenceAbortedCommand` - Confirm abort
- `ToastCommand` - Display notification
- `ParsePageCommand` / `ParseSelectionCommand` - Trigger parsing

**Broadcast** (any → all):
- `ConfigurationUpdatedCommand` - Settings changed
- `CardStateUpdatedCommand` - Card state in Jiten changed
- `DeckListUpdatedCommand` - Deck list changed
- `ParsingPausedCommand` - Parsing toggled
- `ProfileSwitchedCommand` - Profile changed

### Handler Pattern

Background handlers implement `BackgroundCommandHandler<T>`:
```typescript
abstract class BackgroundCommandHandler<T extends BackgroundCommand> {
  abstract readonly command: CommandConstructor<T>;
  abstract handle(sender, ...args): PotentialPromise<ReturnType>;
}
```
Registered in `BackgroundCommandHandlerCollection` which listens on `runtime.onMessage`.

## Code Conventions

- **British spelling** on common words
- **Minimal comments** - only for complex logic
- **File naming**: kebab-case (e.g., `base.parser.ts`, `get-configuration.ts`)
- **Classes**: PascalCase with descriptive names
- **Private fields**: Underscore prefix (`_lookupKeyManager`)
- **Types**: Separate `*.types.ts` files or inline with main export
- **No circular dependencies** (enforced via ESLint)

## Linting Requirements

ESLint enforces:
- 120 character max line length
- Single quotes
- Semicolons required
- Explicit function return types
- Member ordering
- Import restrictions per-scope

Run `npm run lint` before committing. All lint errors must be resolved.
