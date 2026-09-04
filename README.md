# Divan

> *a parrhesia machine for your ideas*

Divan is a self-hosted deliberation engine for hard decisions. It puts your raw idea in front of a
council of seven seats drawn from six different model families, runs them through a structured
six-phase debate, and hands the decision back to you. The human always decides; the council only
deliberates.

The name comes from the *Divan-ı Hümayun*, the imperial council of the Ottoman court, where the
sultan heard his advisors before ruling. *Parrhesia* is the Greek term for frank speech to power,
the opposite of flattery.

**Status: under construction (milestone M2 of 6).** This is not a finished product. Nothing below
is a claim of superiority: the assertion that a council produces better decisions than a single
strong model can only be written once the blind comparison data exists (see §8 of the design), and
that data does not exist yet.

## The problem

Language models have three chronic failure modes: sycophancy (telling you what you want to hear),
false confidence, and hallucination. Divan does not eliminate them. It tries to make them
structurally harder and, where they survive, visible.

The design principle is simple and it drives everything else:

> **A mechanism that lives only in a prompt is not enforced.** A model can forget it, soften it, or
> skip it, and nobody would notice.

So the rules live in graph edges, output schemas and tests instead. Some examples of what that
means in practice:

- The auditor's critique is bound to a JSON schema that **requires** a premortem scenario and at
  least three examined claims, each carrying an evidence label. A critique without a premortem is
  rejected, not warned about.
- A claim cannot be labelled "verified" without a source URL. The rule is enforced in code, and the
  first real model call violated it within minutes, which is exactly why it was moved up the queue.
- The revision loop closes on **numbers**, not on the auditor saying "resolved". Asking a model
  whether its own objection was addressed is precisely where sycophancy enters.
- Nothing rewrites an agent's statement. The system either carries it verbatim or returns it with a
  reason. If an objection is raised in one round and dropped in the next, the dropped objection is
  still shown to you, with the round it came from.
- Raw transcripts are never carried between phases; only token-capped summaries move forward. The
  test suite measures this and asserts zero leakage.

## Engineering honesty

The interesting artefact in this repository may be
[docs/MEKANIZMA-ENVANTERI.md](docs/MEKANIZMA-ENVANTERI.md): a table listing every mechanism the
design promises, what actually enforces it (graph edge, schema, code, test, or nothing yet), the
evidence for that claim, and whether the row is a new mechanism or a debt that was paid off.

At the time of writing: 31 mechanisms enforced, 12 still owed. The debts are listed by name.

Measurements from real runs, including per seat costs and what they revealed, are in
[docs/M2-OLCUMLER.md](docs/M2-OLCUMLER.md). Estimates are labelled as estimates and never mixed
with measurements.

## Documentation

The design documents are written in Turkish, since that is the working language of the project.

- [DESIGN.md](DESIGN.md): the single source of truth. Flow, seats, mechanisms, output formats.
- [PLAN.md](PLAN.md): build order (M0 to M5) and the independent review checklist for each gate.
- [docs/MEKANIZMA-ENVANTERI.md](docs/MEKANIZMA-ENVANTERI.md): mechanism to enforcing layer to evidence.
- [docs/M2-OLCUMLER.md](docs/M2-OLCUMLER.md): numbers from real runs, not projections.
- [docs/M1-KANIT.md](docs/M1-KANIT.md): raw output of the M1 acceptance runs.

## Running

```bash
npm install
cp .env.example .env.local   # put your OpenRouter key here; it never leaves your machine
npm run dev
```

The evidence suite runs without an API key, using deterministic stub agents, and costs nothing:

```bash
npm run e2e
```

To take a real decision to the council:

```bash
npm run oturum -- fikir.txt   # "oturum" = session, "fikir" = idea
```

The session driver streams the debate live, stops at each human gate, and writes the transcript and
a session record when it finishes.

## Stack

Next.js (App Router, TypeScript), LangGraph.js with a SQLite checkpointer, OpenRouter for model
access. The isometric room interface arrives in M4.
