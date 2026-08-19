# Page Events

JitenReader broadcasts its activity to the pages it runs on via `window.postMessage`. This lets other extensions, userscripts and page scripts react to what the user does with JitenReader — for example, a media player can capture a screenshot and audio for the word the user just mined.

Events are enabled by default and can be turned off in the settings (**Other → Broadcast page events for other extensions**).

## Transport

Every event is posted with `window.postMessage` **in the frame where it happened**, restricted to the same origin. There is no cross-frame relaying: if the content you care about lives in an iframe, listen in that iframe.

Anything that can read `message` events in that frame can consume them: the page's own scripts, userscripts, and content scripts of other extensions. Payloads are plain structured-clone data (no functions, no DOM references).

```js
window.addEventListener('message', (event) => {
  const data = event.data;

  if (!data || data.source !== 'jiten-reader' || data.version !== 1) {
    return;
  }

  switch (data.type) {
    case 'active-word-changed':
      // ...
  }
});
```

### Trust

`window.postMessage` is an open channel: **any script in the page can forge a message with `source: 'jiten-reader'`**. Treat events as unauthenticated hints, never as privileged input. Validate the fields you use and do not make security decisions based on them.

## Envelope

Every message carries these fields:

| Field     | Type     | Description                                    |
| --------- | -------- | ---------------------------------------------- |
| `source`  | `string` | Always `'jiten-reader'`.                       |
| `version` | `number` | Payload version, currently `1`.                |
| `type`    | `string` | One of the event types below.                  |

Fields whose value would be `undefined` are omitted from the message entirely.

### Versioning

New fields may be added at any time without a version bump — ignore fields you do not recognise. Renaming or removing a field, or changing its meaning, increments `version`.

## Common card fields

Most events describe a word ("card") and share this shape:

| Field           | Type       | Description                                                              |
| --------------- | ---------- | ------------------------------------------------------------------------ |
| `wordId`        | `number`   | Jiten word id.                                                            |
| `readingIndex`  | `number`   | Index of the reading; `wordId`/`readingIndex` together identify a card.   |
| `spelling`      | `string`   | Dictionary spelling, e.g. `食べる`.                                       |
| `reading`       | `string`   | Kana reading, e.g. `たべる`.                                              |
| `cardState`     | `string[]` | Current states, see below.                                                |
| `frequencyRank` | `number`   | Corpus frequency rank (lower = more frequent).                            |
| `partsOfSpeech` | `string[]` | Part-of-speech tags.                                                      |
| `pitchAccents`  | `number[]` | Pitch accent positions.                                                   |
| `deckIds`       | `number[]` | Ids of the user's study decks containing this word.                       |

`cardState` values: `new`, `young`, `mature`, `mastered`, `blacklisted`, `due`, `redundant`, `suspended`. A card can hold several at once (e.g. `['young', 'due']`).

## Events

### `active-word-changed`

The user started interacting with a parsed word: hovered it, tapped it, or long-pressed it. The most recent event of this type tells you which word the user is currently engaging with.

Consecutive interactions with the same word occurrence are deduplicated: moving the mouse within one word, or clicking a word that was just hovered, emits nothing. Leaving the word ends the occurrence, so hovering it again does emit.

`cardState` here comes from the page's own card cache. Treat `card-state-changed` as the authority on a card's current state.

Additional fields on top of the common card fields:

| Field         | Type     | Description                                                                  |
| ------------- | -------- | ----------------------------------------------------------------------------- |
| `trigger`     | `string` | `'hover'`, `'click'` or `'long-press'`. Requires touchscreen support enabled for the latter two; a word hovered first reports `'hover'` and the following click is deduplicated. |
| `surfaceForm` | `string?`| The word as it appears in the text (conjugated form), furigana stripped.       |
| `sentence`    | `string?`| The sentence containing this occurrence, when sentence tracking is available.  |

```json
{
  "source": "jiten-reader",
  "version": 1,
  "type": "active-word-changed",
  "wordId": 1358280,
  "readingIndex": 0,
  "spelling": "食べる",
  "reading": "たべる",
  "cardState": ["new"],
  "frequencyRank": 1200,
  "partsOfSpeech": ["v1", "vt"],
  "pitchAccents": [2],
  "deckIds": [],
  "trigger": "hover",
  "surfaceForm": "食べた",
  "sentence": "昨日、寿司を食べた。"
}
```

### `card-mined`

The user added a word to a deck: the mining deck, a study deck (deck button or keybind), or automatically through "mine on review". Emitted after the server confirmed the action — this is the natural trigger for capturing media to attach to the new card.

Additional fields:

| Field      | Type      | Description                                                                        |
| ---------- | --------- | ----------------------------------------------------------------------------------- |
| `deckId`      | `number?` | Target study deck id. Absent when the word went to the mining deck.               |
| `sentence`    | `string?` | Sentence sent along with the card. May contain the word wrapped in `**` markers.  |
| `sourceTitle` | `string?` | Origin of the sentence, usually the page title.                                    |

Note: `cardState` reflects the state at the moment of mining; the resulting state change arrives separately as `card-state-changed`.

### `review-graded`

The user graded a card (review buttons or keybinds), including automatic fails from the "auto-fail on dwell" feature. Mass review ("review on-screen words") does not emit this event — its per-card outcomes arrive as `card-state-changed`.

Additional fields:

| Field    | Type     | Description                                    |
| -------- | -------- | ---------------------------------------------- |
| `rating` | `string` | `'again'`, `'hard'`, `'good'` or `'easy'`.     |

### `card-state-changed`

A card's state changed on the server for any reason: grading, mining, blacklisting, suspending, mass review, or changes made in another tab. This is the event to use for keeping external UI in sync.

Payload (does not include the full common card fields):

| Field          | Type       | Description                                                        |
| -------------- | ---------- | ------------------------------------------------------------------ |
| `wordId`       | `number`   | Jiten word id.                                                      |
| `readingIndex` | `number`   | Reading index.                                                      |
| `cardState`    | `string[]` | New states.                                                         |
| `deckIds`      | `number[]` | New deck membership.                                                |
| `spelling`     | `string?`  | Present only when the word appears on the current page.             |
| `reading`      | `string?`  | Present only when the word appears on the current page.             |

### `page-parsed`

A batch of page content finished parsing and its highlights were applied to the DOM. Fires once per registered content block, so it can fire many times on a page that parses incrementally (e.g. manga readers or infinite scrollers). Carries no fields beyond the envelope. Use it as a signal to (re)scan the DOM for `.jiten-word` elements.

## TypeScript definitions

```ts
type JitenCardState =
  | 'new' | 'young' | 'mature' | 'mastered'
  | 'blacklisted' | 'due' | 'redundant' | 'suspended';

interface JitenPageEventBase {
  source: 'jiten-reader';
  version: 1;
}

interface JitenCardFields {
  wordId: number;
  readingIndex: number;
  spelling: string;
  reading: string;
  cardState: JitenCardState[];
  frequencyRank: number;
  partsOfSpeech: string[];
  pitchAccents: number[];
  deckIds: number[];
}

interface ActiveWordChangedEvent extends JitenPageEventBase, JitenCardFields {
  type: 'active-word-changed';
  trigger: 'hover' | 'click' | 'long-press';
  surfaceForm?: string;
  sentence?: string;
}

interface CardMinedEvent extends JitenPageEventBase, JitenCardFields {
  type: 'card-mined';
  deckId?: number;
  sentence?: string;
  sourceTitle?: string;
}

interface ReviewGradedEvent extends JitenPageEventBase, JitenCardFields {
  type: 'review-graded';
  rating: 'again' | 'hard' | 'good' | 'easy';
}

interface CardStateChangedEvent extends JitenPageEventBase {
  type: 'card-state-changed';
  wordId: number;
  readingIndex: number;
  cardState: JitenCardState[];
  deckIds: number[];
  spelling?: string;
  reading?: string;
}

interface PageParsedEvent extends JitenPageEventBase {
  type: 'page-parsed';
}

type JitenPageEvent =
  | ActiveWordChangedEvent
  | CardMinedEvent
  | ReviewGradedEvent
  | CardStateChangedEvent
  | PageParsedEvent;
```

## Example: tracking the last interacted word

```js
let lastWord = null;

window.addEventListener('message', (event) => {
  const data = event.data;

  if (!data || data.source !== 'jiten-reader' || data.version !== 1) {
    return;
  }

  if (data.type === 'active-word-changed') {
    lastWord = {
      wordId: data.wordId,
      readingIndex: data.readingIndex,
      spelling: data.spelling,
      reading: data.reading,
      surfaceForm: data.surfaceForm,
      sentence: data.sentence,
    };
  }

  if (data.type === 'card-mined' && typeof data.wordId === 'number') {
    // The user just mined a card — capture media for it here.
    captureMediaFor(data);
  }
});
```
