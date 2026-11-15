# 24 · Find the missing reference links

A patient, repetitive job for an inexpensive model in a tool that can open web pages. It changes no code.

| | |
|---|---|
| Branch | `lane/24-reference-links` |
| You own | `docs/REFERENCES.md` only |
| Read first | `docs/REFERENCES.md`, and the files named in the task below (read only) |

## Prompt

Open `docs/REFERENCES.md`. It lists the references already checked. Your job is to find a correct address for every statement in the app that still shows "Source: to be confirmed", and write them into that file. You change nothing else: no code, no other document.

**Find the statements.** Search `app/src` for `verified: false`, for `SourceLine text=""` and for the words "to be confirmed". For each place, write down the file, and the exact sentence or number the reader sees next to it. Also take the six "body of work" entries listed at the end of `docs/REFERENCES.md`.

**For each one, look for a source, in this order of preference:**

1. A NASA page: the Human Research Program evidence reports and risk pages (`nasa.gov/reference/...`, `humanresearchroadmap.nasa.gov`), or NASA's technical reports server (`ntrs.nasa.gov`).
2. A page from another space agency (ESA, CSA, JAXA).
3. A paper in PubMed. Give the address in the form `https://pubmed.ncbi.nlm.nih.gov/<number>/`, never a search address.

**Rules. These matter more than finishing.**

- Open every page you list and read the part that supports the statement. Copy the sentence that supports it, word for word, in quotation marks, at most 25 words.
- If the page does not actually say what the app says, do not list it. Write "no source found" and, if the page says something different, what it says. A wrong link is worse than none.
- Never write an address you have not opened in this session. Never build an address from memory or from a pattern.
- Do not correct the app's numbers or wording. Report differences; a person decides.

**Write the result** as a new section at the end of `docs/REFERENCES.md`, titled "Statements still to be confirmed", one table row per statement: where it is in the app (file), the statement, the address, the supporting sentence, and a note. Sort it by file.

**Report:** how many statements you found, how many now have a source, how many have none, and any statement where the source disagrees with the app.

Commit, push this branch, and report. Do not merge.
