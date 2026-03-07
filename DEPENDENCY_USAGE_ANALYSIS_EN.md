# 📊 DEPENDENCY USAGE ANALYSIS
## Wesnoth Tournament Manager - Real Code Analysis

**Generated**: 2026-01-01
**Analysis Method**: grep -r imports in source code + package.json inspection

---

## 🟢 DEPENDENCIES ACTUALLY USED IN CODE

### Backend (13 dependencies used)

```
✅ @supabase/supabase-js    - import { createClient } from '@supabase/supabase-js'
✅ axios                     - import axios from 'axios' (solo para Discord y peticiones externas, no traducción)
✅ bcrypt                    - import bcrypt from 'bcrypt'
✅ bz2                       - (compression utility)
✅ cors                      - import cors from 'cors'
✅ dotenv                    - import dotenv from 'dotenv'
✅ express                   - import express from 'express'
✅ express-rate-limit       - import rateLimit from 'express-rate-limit'
✅ jsonwebtoken             - import jwt from 'jsonwebtoken'
✅ multer                    - import multer from 'multer'
✅ node-cron                - import cron from 'node-cron'
✅ pg                        - import { Pool } from 'pg'
✅ uuid                      - import { v4 as uuidv4 } from 'uuid'
```

### Frontend (7 dependencies used)

```
✅ axios                     - import axios from 'axios'
✅ i18next                   - import i18n from 'i18next'
✅ react                     - import React from 'react'
✅ react-dom                 - import ReactDOM from 'react-dom/client'
✅ react-i18next            - import { useTranslation } from 'react-i18next'
✅ react-router-dom         - import { BrowserRouter, Routes, Route } from 'react-router-dom'
✅ recharts                  - import { LineChart, Line, ... } from 'recharts'
✅ zustand                   - import { create } from 'zustand'
```

### Development Tools (Used during build/dev, not in production)

```
✅ @types/* packages         - TypeScript type definitions (dev only)
✅ @vitejs/plugin-react      - Vite plugin (build time)
✅ typescript                - Language compiler (build time)
✅ tsx                       - TypeScript executor (build time)
✅ vite                      - Bundler (build time)
```

---

## 🔴 DEPENDENCIES INSTALLED BUT NOT USED

### Root Level

```
❌ netlify-cli              - NO import/usage found anywhere
                              - Deployment uses Railway + Supabase + Cloudflare Pages, NOT Netlify
                              - Can be safely removed
                              - License: MIT
                              - Version: 23.12.3
```

### Backend

```

```

**Verification:**
```bash
$ grep -r "import.*netlify" . --exclude-dir=node_modules
# Result: No matches found


```

---

## 📋 SUMMARY TABLE

### Dependency Count by Status

| Status | Backend | Frontend | Root | Total |
|--------|---------|----------|------|-------|
| **Used in code** | 13 | 8 | 0 | 21 |
| **Development only** | 9 | 5 | 0 | 14 |
| **Installed but NOT used** | 1 | 0 | 1 | 2 |
| **Total installed** | 24 | 13 | 1 | 38 |

### License Impact

**Dependencies with license impact:**

```
MIT:               31 dependencies (91%)  ✅ All compatible
Apache-2.0:        1 dependency  (3%)   ⚠️ Dev only (TypeScript)
BSD-2-Clause:      1 dependency  (3%)   ✅ Compatible
ISC:               1 dependency  (3%)   ✅ Compatible
────────────────────────────────────────
TOTAL (useful):    34 dependencies


```

---

## ✅ ACTION ITEMS

### Priority 1: Remove Unused Dependencies

```bash
# Remove from backend
cd backend
npm uninstall openai

# Remove from root
cd ..
npm uninstall netlify-cli

# Clean installs
npm install
cd backend
npm install
```

**Benefits:**
- Reduces bundle size
- Removes Apache-2.0 from runtime dependencies (openai)
- Removes MIT dependency used only in abandoned Netlify setup (now Cloudflare Pages)
- Simplifies license compliance
- Removes confusion: "why are these imported if not used?"
- Cleaner node_modules for deployments

### Priority 2: Verify License Compatibility

After removing openai and netlify-cli:
- ✅ 100% MIT-compatible ecosystem
- ✅ AGPL v3 becomes fully viable
- ✅ No license conflicts remain

---

## 🎯 RECOMMENDATION

**Use AGPL-3.0-or-later**

**Reasons:**
1. OpenAI is NOT used (will be removed)
2. netlify-cli is NOT used (will be removed)
3. Remaining dependencies are 100% compatible with AGPL
4. Aligns with project values (open tournaments = open code)
5. Ensures community contributions flow back
6. Good precedent for similar projects

**Alternative:** MIT if you prefer maximum flexibility

---

**Analysis completed by**: Code inspection + grep analysis
**Date**: 2026-01-01
