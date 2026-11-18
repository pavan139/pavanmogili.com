# Count Lineages, Not Checkpoints

Code, results and paper source for *Count Lineages, Not Checkpoints: LLMs Are Not Independent
Test-Takers*.

Item-level analyses of LLM benchmarks (item response models, label-error screens, differential
item functioning) treat every evaluated model as an independent respondent. Most leaderboard
entries share a base model with many others. This repository measures what that does to
uncertainty and provides a tool to account for it.

**Paper:** [`rewrite/main.pdf`](rewrite/main.pdf). It has not been peer reviewed; see
[Status and limitations](#status-and-limitations).

## What the paper finds

The numbers are the ones in the abstract. Every number in the paper is generated from the
stored result files; [Check the numbers](#check-the-numbers) shows how to regenerate them.

| Question | Result |
|---|---|
| How concentrated is a leaderboard panel? | Of 1,151 archived Open LLM Leaderboard entries, 84% can be assigned to a base-model family and 29% belong to one family. By family sizes the panel is as concentrated as about 10 equal families; its 4,497-entry successor, about 15. |
| Do the usual intervals hold? | In a simulation matched to the archive's family sizes and within-family similarity, nominal 95% intervals for item difficulty cover their target 28 to 37% of the time. Resampling whole families restores 89 to 90%; weighting families equally lowers the variance of difficulty estimates 5.2 to 7.5-fold. |
| What changes on real responses? | Family-level standard errors of item-rest correlations are 1.4 to 2.0 times the model-level ones, and 16 to 52% of the items a screen flags as significantly negative lose significance. |
| Differential item functioning | On the newer leaderboard, two arbitrary collections of unrelated base models differ on 12 to 41% of items, so claims about named families need a lineage baseline. |
| Does lineage find label errors better? | No. Against documented label errors (GSM8K-Platinum, MMLU-Redux), lineage-aware scores rank flawed items no better than the usual screen. Lineage changes how much evidence a flag carries, not which items to inspect first. |

## Layout

| Folder | Contents |
|---|---|
| `rewrite/` | Paper source and PDF. Every table, figure and in-text number is generated; see `rewrite/README.md`. |
| `pilot_neff/` | Analysis code and stored result files. `make_tables.py` and `make_figures.py` build the paper's tables and figures from them. |
| `modelkin/` | Standalone Python tool: family labels for three panels, family bootstrap, panel composition, screening audit. |
| `evalens_release_package/data/` | Response matrices for the archive and the curated panel, with upstream licences in `evalens_release_package/licenses/`. |

## Quick start

```bash
cd modelkin
pip install -e .
modelkin audit --matrix ../evalens_release_package/data/core_matrix_trimmed.npz \
               --labels data/open_llm_leaderboard_v1_families.csv --task arc
```

It prints the archive panel's composition and the ARC screening audit:

```text
Panel: 1151 models, 127 labelled families, 187 unassigned
  largest family 332 (29%), effective clusters 10.0
Residual similarity: same family +0.092, different family -0.015
Variance inflation (lower bound): difficulty median 4.3x, 90th pct 24.5x; discrimination median 2.6x
Significantly negative items: Fisher test 134, model bootstrap 119, family bootstrap 94 (family/model standard errors x1.7)
```

`pip install -e '.[test]' && python -m pytest -q` inside `modelkin/` runs its 14 tests.

## Check the numbers

The paper's tables and in-text numbers are built from the stored result files in `pilot_neff/`.
With NumPy and SciPy installed (the `modelkin` install above brings both):

```bash
cd pilot_neff
python make_tables.py   # rewrites ../rewrite/numbers.tex and ../rewrite/tab_*.tex
git status ../rewrite   # nothing should have changed
```

`make_tables.py` also rewrites `pilot_neff/validation.json`, whose correlations can differ in
the last floating-point digits on another NumPy build. This re-runs the table step only. The
simulations, bootstraps, audits and metadata fetches behind the stored result files take
longer and some need network access; the next section covers them.

## Reproducing the paper

`rewrite/README.md` lists the commands in order. Three inputs are fetched by the scripts and
are not stored here:

- item-level responses for the newer leaderboard, from the RouterEval release
  (`leaderboard_score.zip`, read only through `pilot_neff/safe_pickle.py`);
- GSM8K-Platinum and MMLU-Redux error annotations;
- live repository metadata from Hugging Face (snapshots of what was retrieved on
  15 November 2026 are stored in `pilot_neff/`).

Run the scripts from inside `pilot_neff/`. Several of them are plain scripts that execute on
import, so run them, do not import them.

## Status and limitations

- Single-author work that has not been peer reviewed or checked by an independent human
  reviewer. `rewrite/README.md` records its review history.
- No item-level responses for 2025-26 models were found publicly at scale; the newest panel
  ends in March 2025.
- The label-error and DIF re-audits re-run published procedures without reproducing the
  original pipelines.
- Family labels come from Hugging Face metadata retrieved on 15 November 2026. Re-fetching can
  change them if repositories have been edited or deleted since.

## Licence

Code: MIT (see `LICENSE`). Data: see `evalens_release_package/DATA_SOURCES.md` and the
licence files next to it; the benchmark question text in `data/cache/` remains under its
upstream licences.
