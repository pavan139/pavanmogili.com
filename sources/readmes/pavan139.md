<a href="https://github.com/pavan139">
  <img src="./assets/hero.svg" width="100%" alt="Pavan Reddy Mogili, Applied AI Engineer, open to Applied AI and LLM platform roles. I build the reliability layer around LLMs. Receipts from my repos: agent-regression caught 128/128 injected faults; temporal-rag recovered 19/19 exact sources vs 11/19 for a baseline; resilient-agent-runtime passes 12/12 defined failure cases; capability-guard has 17 adversarial tests; hard-negative-retrieval index recall@5 goes from 0.74 to 1.00; speculative decoding median time went from 292.9 to 109.8 ms on a CPU fixture.">
</a>

<p align="center">
  <a href="https://www.linkedin.com/in/pavan-reddy-mogili/"><img src="./assets/btn-linkedin.svg" height="46" alt="Connect with Pavan Reddy Mogili on LinkedIn"></a>&nbsp;
  <a href="mailto:pavanreddy139@gmail.com"><img src="./assets/btn-email.svg" height="46" alt="Email Pavan Reddy Mogili"></a>&nbsp;
  <a href="#featured-work"><img src="./assets/btn-work.svg" height="46" alt="Jump to Pavan's featured AI engineering projects"></a>
</p>

## Hi, I'm Pavan 👋

I'm a **Senior Data Scientist at Fidelity Investments**, and I build the reliability layer around LLMs: the retrieval that decides what a model gets to see, the evals that catch a regression before users do, the permission check in front of every tool call, and the runtime that survives a crash at the worst possible moment.

**Start here**

- **[PlanDesk](https://github.com/pavan139/plandesk)** is a real-LLM app with its own eval: cited answers on U.S. retirement-plan rules from IRS publications. With gpt-5.4-mini it got 97.1% of 35 answerable questions right and refused all 7 out-of-scope ones. Closed book scored 94.3%, but it answered 3 of those 7 with nothing to cite.
- **[Count Lineages, Not Checkpoints](https://github.com/pavan139/count-lineages)** is my research on LLM benchmarks: 29% of 1,151 archived Open LLM Leaderboard models belong to one base-model family, and in a simulation matched to that panel, nominal 95% intervals for item difficulty cover their target only 28 to 37% of the time.
- **[Nineteen labs](#every-layer-around-the-model)**, each built around one way LLM systems fail, with tests, CI and a README that says what the experiments show and what they don't.

**Open to Applied AI, LLM platform and ML infrastructure roles.** The quickest way to reach me is [email](mailto:pavanreddy139@gmail.com) or [LinkedIn](https://www.linkedin.com/in/pavan-reddy-mogili/).

## Flagship: PlanDesk

<a href="https://github.com/pavan139/plandesk"><img src="./assets/cards/plandesk.svg" width="100%" alt="PlanDesk (Python): grounded answers on U.S. retirement-plan rules from IRS Publications 590-A, 590-B and 560 with a real LLM, year-aware hybrid retrieval and verified quotes. 97.1% correct on 35 answerable questions and 7 of 7 unanswerable questions refused."></a>

A real-LLM application, end to end: the same pattern as the RAG assistant I built at work, rebuilt on public IRS documents so anyone can check every answer.

- **Retrieval:** BM25 + embeddings fused, filtered to the tax-year edition the question asks about. Honest result: naive RAG without the filter scored the same 97.1%, because the model picks the right year when both editions are in context. The filter's measurable effect is narrower: citations come from the edition that matches the question.
- **Grounding:** the model must return verbatim quotes, and each one is checked against its cited excerpt; if none of them is found there, the answer becomes a refusal.
- **Evaluation:** 42 hand-written questions, deterministic scoring with no LLM judge. Closed book scored 94.3% because the model already knows most limits, but it answered 3 of 7 out-of-scope questions anyway and none of its answers can be traced to a source. Every miss is listed in the report, and CI re-scores the recorded runs as a release gate.

## Research: Count Lineages, Not Checkpoints

[count-lineages](https://github.com/pavan139/count-lineages): item-level analyses of LLM benchmarks treat every leaderboard model as an independent test-taker, but most share a base model with many others. This work measures what that does to uncertainty in IRT and label-error screens, and ships `modelkin`, a tool that accounts for model families.

- On the archive's real responses, family-level standard errors of item-rest correlations are 1.4 to 2.0 times the model-level ones, and 16 to 52% of the items a screen flags as significantly negative lose significance.
- The unflattering part: against documented label errors in GSM8K-Platinum and MMLU-Redux, lineage-aware scores rank flawed items no better than the usual screen. Lineage changes how much evidence a flag carries, not which items to inspect first.

Paper source and PDF, analysis code, response matrices and `modelkin` are in the repo; preprint coming soon.

## Building now: Turtledove

<img src="./assets/turtledove.svg" width="100%" alt="Turtledove, a SwiftUI iPhone app for couples built by Pavan Reddy Mogili: shared plans, trips, habits and a journal, with widgets, Siri, on-device Apple Intelligence, a Supabase Postgres backend and an MCP server for AI assistants. Closed beta on TestFlight.">

Designed and built solo, end to end:

- **iOS:** native SwiftUI with SwiftData, WidgetKit, App Intents for Siri and Shortcuts, and on-device Apple Intelligence for spelling fixes and meaning-aware search, so those features never send data to Turtledove's servers
- **Backend:** Supabase with Postgres row-level security, transactional pairing, Deno edge functions and a push notification worker
- **AI integration:** a remote MCP server (32 tools, OAuth 2.1) so assistants like ChatGPT and Claude can read and add plans, with every connection approved on your iPhone
- **Status:** closed beta on TestFlight. The code is private for now, and I'm happy to walk through it in an interview.

## Every layer around the model

<img src="./assets/system-map.svg" width="100%" alt="System map of an LLM application with Pavan Reddy Mogili's projects on each layer. Data and features: chronofeature, eventflow, incremental-lakehouse, query-forge. Serving: servegate, model-ledger, quorum-lab. Retrieval: temporal-rag, hard-negative-retrieval. Model and decoding: speculative-decoding, constrained-generation, model-router, pixel-to-program. Guardrails: capability-guard. Tools and runtime: resilient-agent-runtime, agent-arena. Evaluation and monitoring: agent-regression, tool-calling-lab, drift-sentinel.">

Twenty-one public project repos: a real-LLM flagship, an evaluation research project, and nineteen labs each built around a specific failure mode, from retrieval and decoding to data pipelines and consensus. Every one ships with tests and a README that records what the experiments actually show, including the unflattering results. Most labs run on deterministic fixtures and synthetic data with no required third-party packages, so anyone can rerun them; their numbers measure the mechanism, not model quality.

<a id="featured-work"></a>

## Featured work

<p>
  <a href="https://github.com/pavan139/agent-regression"><img src="./assets/cards/agent-regression.svg" width="49%" alt="Agent Regression (Python): regression testing for AI agents that grades outputs and execution traces against independent oracles to gate releases. Detected 128/128 injected faults across 8 fault types on a deterministic fixture agent; 21/21 baseline contracts pass."></a>
  <a href="https://github.com/pavan139/temporal-rag"><img src="./assets/cards/temporal-rag.svg" width="49%" alt="Temporal RAG (Python): retrieval over changing facts with bitemporal queries, provenance, citations and abstention. Recovered 19/19 exact source sets vs 11/19 for a lexical plus recency baseline on synthetic facts."></a>
  <a href="https://github.com/pavan139/resilient-agent-runtime"><img src="./assets/cards/resilient-agent-runtime.svg" width="49%" alt="Resilient Agent Runtime (Python): transactional outbox and inbox, payload-bound deduplication and crash recovery, so a redelivered agent action is not applied twice. Passes 12/12 defined failure cases."></a>
  <a href="https://github.com/pavan139/capability-guard"><img src="./assets/cards/capability-guard.svg" width="49%" alt="Capability Guard (Python): HMAC-signed least-privilege capabilities for LLM tool use with scopes, revocation, quotas and replay protection. 17 adversarial tests."></a>
  <a href="https://github.com/pavan139/tool-calling-lab"><img src="./assets/cards/tool-calling-lab.svg" width="49%" alt="Tool Calling Lab (Python): execution-based evaluation of LLM tool calls, synthetic data, LoRA supervised fine-tuning and DPO preference optimization. 40 tests, including opt-in checks that resume LoRA SFT and DPO runs bitwise-identically on tiny weights."></a>
  <a href="https://github.com/pavan139/hard-negative-retrieval"><img src="./assets/cards/hard-negative-retrieval.svg" width="49%" alt="Hard-Negative Retrieval (Python): contrastive embedding training with hard-negative mining, late-interaction MaxSim scoring and approximate nearest neighbor index evaluation. Recall@5 against exhaustive MaxSim rises from 0.74 with 1 probe and 16 candidates to 1.00 with 8 probes and 96 candidates."></a>
  <a href="https://github.com/pavan139/speculative-decoding"><img src="./assets/cards/speculative-decoding.svg" width="49%" alt="Speculative Decoding (Python): exact draft-and-verify rejection sampling for faster LLM inference with KV-cache recovery. Cached block verification ran 2.7 times faster than full-prefix serial verification on a tiny CPU fixture (median 292.9 ms to 109.8 ms)."></a>
  <a href="https://github.com/pavan139/servegate"><img src="./assets/cards/servegate.svg" width="49%" alt="ServeGate (Go): model serving gateway with deadline-aware microbatching, fair multi-tenant admission control, cancellation and circuit breaking. 128 backend calls reduced to 16 with 8-way batching."></a>
</p>

### More AI experiments

| Layer | Project | What it explores |
| --- | --- | --- |
| Model & decoding | [constrained-generation](https://github.com/pavan139/constrained-generation) | Grammar-constrained decoding with incremental parsing, token masks and bounded interpreters |
| Model & decoding | [model-router](https://github.com/pavan139/model-router) | Learned routing between a cheaper and a stronger model on simulated costs: 25/36 correct vs 23/36 for always-large at budget 180, and it loses to always-small at tight budgets |
| Model & decoding | [pixel-to-program](https://github.com/pavan139/pixel-to-program) | An encoder-decoder that reads an image and writes the program that draws it |
| Tools & runtime | [agent-arena](https://github.com/pavan139/agent-arena) | D* Lite replanning for bounded agents: 5,108 vs 13,193 vertex expansions for repeated BFS, at the cost of more edge checks |
| Evaluation & monitoring | [drift-sentinel](https://github.com/pavan139/drift-sentinel) | Sequential drift monitoring with delayed labels and an alert lifecycle |

### Systems foundations

The data and infrastructure underneath ML systems: feature stores, streaming, warehouses, registries and consensus.

| Layer | Project | What it explores |
| --- | --- | --- |
| Data & features | [chronofeature](https://github.com/pavan139/chronofeature) | Point-in-time feature store that keeps future data out of training, with offline/online parity |
| Data & features | [eventflow](https://github.com/pavan139/eventflow) | Event-time stream processing: watermarks, retractions, checkpoints and deterministic recovery |
| Data & features | [incremental-lakehouse](https://github.com/pavan139/incremental-lakehouse) | Incremental CDC warehouse with schema contracts, lineage and atomic publish |
| Data & features | [query-forge](https://github.com/pavan139/query-forge) | A small SQL engine with a join optimizer, checked against SQLite. On the demo query the optimized plan does 805 hash probes where the reference checks 100,644 nested-loop pairs (work counters, not latency) |
| Serving | [model-ledger](https://github.com/pavan139/model-ledger) | Content-addressed model registry with lineage, compare-and-swap promotions and rollback |
| Serving | [quorum-lab](https://github.com/pavan139/quorum-lab) | Durable Raft in Go under network partitions and restarts, with a safety checker |

## The path so far

Software and data engineering at **Cognizant**, an **M.S. in Data Science at Northeastern University** (where I also TA'd AI/ML and deep learning), machine learning on biomedical text at **Affinia Therapeutics**, and data science at Fidelity since 2023. The lesson that stuck with me is that the model is rarely the part that breaks. Everything around it is. That's the part I build, test, and write up honestly, including when the numbers are unflattering.

<img src="./assets/timeline.svg" width="100%" alt="Career timeline of Pavan Reddy Mogili: B.Tech in Computer Engineering at JNTU (2015 to 2019); Software Engineer at Cognizant (2019 to 2021); M.S. in Data Science at Northeastern University with a 4.0 GPA and graduate teaching assistant roles (2021 to 2023); Machine Learning Intern at Affinia Therapeutics (2022); Senior Data Scientist at Fidelity Investments (2023 to now); doctoral program at the University of the Cumberlands (2026 to now); building Turtledove, an iOS app (2026).">

## Toolbox

<img src="./assets/toolbox.svg" width="100%" alt="Toolbox. AI and LLM: PyTorch, Hugging Face, RAG, embeddings, LoRA, SFT, DPO, LLM evals, tool calling, MCP, on-device AI. Backend and data: Python, Go, FastAPI, Pydantic, TypeScript, SQL, PostgreSQL, SQLite, pandas, Snowflake, Supabase. Infra and apps: Docker, Kubernetes, AWS, GitHub Actions, CI/CD, observability, Swift, SwiftUI, Deno.">

## Off the keyboard

- 📚 Doctoral student at the University of the Cumberlands. My research interest: how LLMs actually change everyday work.
- 🏔️ Happiest on a road trip with a national park at the end of it.
- 🏃 Slowly, stubbornly training for a 5K.

<a href="mailto:pavanreddy139@gmail.com">
  <img src="./assets/footer.svg" width="100%" alt="Thanks for stopping by. Building something with LLMs that has to actually work? Email pavanreddy139@gmail.com or connect with Pavan Reddy Mogili on LinkedIn.">
</a>
