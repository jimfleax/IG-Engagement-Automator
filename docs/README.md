# Instagram Engagement Automator — Documentation Hub

Welcome to the comprehensive documentation suite for the Instagram Engagement Automator Chrome Extension codebase.

---

## Documentation Index

| Document | Description |
|---|---|
| [Architecture Overview](ARCHITECTURE_OVERVIEW.md) | High-level system design, Manifest V3 isolated world pattern, dual navigation lifecycles, and cross-cutting concerns. Explains how the React HUD, background worker, sniffer, and automation engines collaborate. |
| [Codebase Directory & File Index](CODEBASE_DIRECTORY_AND_FILE_INDEX.md) | Exhaustive directory tree and searchable file reference detailing responsibilities and exports for every file in the repository. Provides an instant lookup guide for contributors and AI agents navigating the project. |
| [Views & Components Catalog](VIEWS_AND_COMPONENTS_CATALOG.md) | In-depth breakdown of all React components, floating HUD tabs, popup monitors, and reusable UI widgets. Details component props, local states, interaction hooks, and rendering conditions. |
| [Endpoint Mapping Reference](ENDPOINT_MAPPING.md) | Architectural specification of Instagram GraphQL mutations, legacy REST web endpoints, and internal Chrome runtime messages. Documents payload structures, session authentication requirements, and failure fallbacks. |
| [Data Models & Schemas Reference](BACKEND_API_AND_DATA_MODELS.md) | Complete reference for persistent storage layers including Dexie IndexedDB schemas, CSV export serializers, and Chrome storage configuration stores. Details field constraints, indexes, and default settings shapes. |
| [Local Setup & Environment Guide](../LOCAL_SETUP_ENV.md) | Step-by-step developer guide for cloning, installing dependencies, building the extension, and loading the unpacked build into Google Chrome. |
| [Contributor Guide](../CONTRIBUTOR_GUIDE.md) | Clear developer handbook covering coding conventions, feature testing procedures, architecture cheat sheets, and PR contribution workflows. |

---

## Recommended Reading Order

1. **New Contributors / Quick Setup:**
   Start with the [Local Setup Guide](../LOCAL_SETUP_ENV.md) to build and install the extension locally, followed by the [Contributor Guide](../CONTRIBUTOR_GUIDE.md) for testing and development conventions.
2. **System Architecture & Design:**
   Read [Architecture Overview](ARCHITECTURE_OVERVIEW.md) to understand the execution worlds, state machine, and dual feed/modal navigation loops.
3. **Frontend & UI Development:**
   Consult the [Views & Components Catalog](VIEWS_AND_COMPONENTS_CATALOG.md) and [Codebase Directory & File Index](CODEBASE_DIRECTORY_AND_FILE_INDEX.md).
4. **Data Layer & Protocol Engineering:**
   Study [Data Models & Schemas Reference](BACKEND_API_AND_DATA_MODELS.md) and [Endpoint Mapping Reference](ENDPOINT_MAPPING.md) for GraphQL mutation harvesting and IndexedDB tables.

---

*Last generated: October 31, 2026*
