# WIPO Global Brand Database: image-similarity clearance attempt

Status: BLOCKED. No similarity results were obtained. No clearance conclusion can be drawn from this run.

## What was run
- Rendered PNGs (Playwright chromium, white background): wordmark (1200px, both lines), line1 (1200px, QUOTESDONE only), mark (800px). Stored in the session scratchpad only.
- Opened https://branddb.wipo.int/en/similarlogo. A passive "Verifying... / Verified" interstitial passed on its own after a few seconds.
- Upload worked: the file input accepted line1.png and the page showed it (see `line1-upload-accepted.png`). The UI offers 4 strategies (Conceptual, Shape, Color, Composite) and filters for IP office and Nice classification.
- Clicked Search with Shape strategy. The results page reported "36,202,634 results" but the grid stayed empty (`line1-shape-search-EMPTY-401-evidence.png`).

## What came back
- Every `POST https://api.branddb.wipo.int/search` returned HTTP 401, repeatedly, across several runs (about 20 s of waiting each). The page fetches ALTCHA proof-of-work captcha challenges from `api.branddb.wipo.int/captcha` and the search API still rejects the session. The 36M count is a placeholder, not a real result count.
- The brand-name text search (TESLA) goes through the same API gate, and `dbinfo` calls were also intermittently 401 (`tesla-text-search-attempt.png`, the form loaded but no search succeeded).
- Under the task's rules (stop if the site blocks automation or a captcha appears), I stopped. I did not forge/replay tokens, call the API directly, or otherwise bypass the gate. The upload step itself was not the problem; the search authorisation was.

## Not done
- No unfiltered, AE-office or Nice 9/35/38/42 result lists for any candidate (wordmark, line1, mark). Filters were not exercised because the base search never returned data.
- No Tesla logo retrieved from WIPO, so no side-by-side image was made.

## Tesla ("TES" cluster): provisional, from memory only, UNVERIFIED
I could not view the registered Tesla wordmark. From general recollection, Tesla's wordmark is a wide, custom geometric face with a distinctive T whose top bar has a notch, and spaced letters. Our shared-stroke TES cluster merges T, E and S into one connected form inside a longer word, QUOTESDONE. Likely judgement: different overall impression (different word, merged strokes), but a TES-fragment resemblance cannot be excluded without seeing both marks. Treat this as a hypothesis for a lawyer or a manual check, not a finding.

## Limits and next steps
- Automated image search needs a session WIPO accepts. A person using a normal browser may get results; try the same upload manually (Shape and Conceptual strategies, then office AE and Nice 9/35/38/42) and screenshot the first 15.
- Even when it works, visual search is AI similarity ranking: it ignores goods/services relevance, misses stylised or device-heavy marks, covers only the data sources WIPO ingests (not all UAE filings), and is not a legal clearance opinion. Pair with word-mark searches and a professional search.
