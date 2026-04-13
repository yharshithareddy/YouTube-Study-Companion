# Discover Data

This folder stores evaluation data for the `Discover` recommendation system.

## Layout

- `corpus/`
  - real-style stored video records
- `transcripts/`
  - local transcript text files for stored videos
- `analysis/`
  - normalized extracted analysis for each stored video
- `labels/`
  - request-level expected outcomes for offline evaluation
- `schemas/`
  - JSON schema-like reference files for corpus and labels

## Purpose

This data layer exists so `Discover` can be tested against meaningful stored records instead of repeatedly calling live APIs during development.

## Important

The sample files in this folder are scaffolding only. They show how real data should be stored, but they are not a complete production corpus yet.
