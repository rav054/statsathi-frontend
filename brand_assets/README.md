# StatSathi — Official Brand Assets & Design System

> **StatSathi**  
> *Your Research Analytics Companion*

Welcome to the official brand assets repository for **StatSathi**. This package contains production-ready vector (`.svg`) and high-resolution raster (`.png`) assets designed for web, mobile, print, and documentation.

---

## 1. Brand Identity & Visual Concept

The StatSathi brand mark synthesizes the rigor of mathematical statistics with empirical agricultural and biomedical research:

- **The Scatter "S"**: An elegant, recognizable 'S' glyph sculpted entirely from discrete data points (scatter plot).
- **The Cartesian Coordinate Grid**: Clean orthogonal axes (horizontal solid, vertical dashed-through) anchoring data in empirical space.
- **The Eigenvector / PCA Trend Arrow**: A diagonal double-headed vector symbolizing principal component analysis, linear correlation, and multidimensional data transformation.
- **Confidence Ellipses**: Faint 95% confidence intervals circumscribing each cluster.
- **The Signature Focus / Outlier Point**: A warm tangerine accent dot within the analytical indigo cluster, highlighting statistical discovery, anomaly detection, and empirical insight.
- **Dual Analytical Disciplines**:
  - **Upper Cluster (Indigo/Violet)**: Represents mathematical modeling, statistical theory, algorithms, and computational intelligence.
  - **Lower Cluster (Emerald/Mint)**: Represents empirical fieldwork, biological growth, agricultural sciences, and practical discovery.

---

## 2. Color Palette & Specifications

| Role | Color Name | HEX Code | RGB | Tailwind Token |
|---|---|---|---|---|
| **Primary Brand Accent** | Electric Indigo | `#4F46E5` | `rgb(79, 70, 229)` | `indigo-600` |
| **Secondary Analytical** | Royal Violet | `#3730A3` | `rgb(55, 48, 163)` | `indigo-800` |
| **Supporting Periwinkle** | Soft Indigo | `#6366F1` | `rgb(99, 102, 241)` | `indigo-500` |
| **Highlight Periwinkle** | Lavender Glow | `#818CF8` | `rgb(129, 140, 248)` | `indigo-400` |
| **Signature Outlier** | Vivid Tangerine | `#F97316` | `rgb(249, 115, 22)` | `orange-500` |
| **Primary Field / Growth**| Emerald Green | `#059669` | `rgb(5, 150, 105)` | `emerald-600` |
| **Deep Empirical** | Forest Teal | `#047857` | `rgb(4, 120, 87)` | `emerald-700` |
| **Bright Bio Growth** | Mint Turquoise | `#10B981` | `rgb(16, 185, 129)` | `emerald-500` |
| **Seafoam Accent** | Pale Mint | `#34D399` | `rgb(52, 211, 153)` | `emerald-400` |
| **Coordinate Grid** | Slate Gray | `#CBD5E1` | `rgb(203, 213, 225)` | `slate-300` |
| **PCA Vector Arrow** | Slate Steel | `#94A3B8` | `rgb(148, 163, 184)` | `slate-400` |
| **Primary Wordmark** | Obsidian Navy | `#0F172A` | `rgb(15, 23, 42)` | `slate-900` |
| **Tagline Text** | Muted Slate | `#64748B` | `rgb(100, 116, 139)` | `slate-500` |
| **Dark Mode Background**| Midnight Slate | `#0F172A` | `rgb(15, 23, 42)` | `slate-900` |

---

## 3. Directory Structure

```
brand_assets/
├── svg/
│   ├── statsathi_primary_mark.svg       # Master scatter S with axes, ellipses & vector
│   ├── statsathi_simple_mark.svg        # Clean scatter S on axes (no vector/ellipses)
│   ├── statsathi_favicon.svg            # Minimalist dual-arc geometric S
│   ├── statsathi_on_dark.svg            # Luminous neon scatter S on dark background
│   ├── statsathi_mono_black.svg         # Single-color black dots for print/stamps
│   ├── statsathi_mono_white.svg         # Single-color white dots on slate background
│   ├── statsathi_horizontal_lockup.svg  # Primary mark + "StatSathi" wordmark
│   └── statsathi_stacked_lockup.svg     # Primary mark + wordmark + tagline
├── png/
│   ├── statsathi_primary_mark.png       # 1024×1024 transparent PNG
│   ├── statsathi_simple_mark.png        # 1024×1024 transparent PNG
│   ├── statsathi_favicon.png            # 1024×1024 transparent PNG
│   ├── statsathi_on_dark.png            # 1024×1024 on #0F172A
│   ├── statsathi_mono_black.png         # 1024×1024 transparent PNG
│   ├── statsathi_mono_white.png         # 1024×1024 on #334155
│   ├── statsathi_horizontal_lockup.png  # 2048×584 transparent PNG
│   └── statsathi_stacked_lockup.png     # 1600×1125 transparent PNG
└── README.md                            # Brand Guidelines and Usage Specs
```

---

## 4. Variant Usage Guide

### 1. `primary_mark`
- **Use for**: Master brand presentation, hero banners, app splash screens, marketing landing pages.
- **Properties**: Full visual richness with coordinate grid, confidence ellipses, vector arrow, and dual clusters.

### 2. `simple_mark`
- **Use for**: Editorial publications, academic research papers, reports, uncluttered headers where vectors might distract from data.

### 3. `favicon` / Small Icon
- **Use for**: Browser tabs (16px / 32px), mobile app home-screen icons, browser bookmarks, notification badges.
- **Properties**: Continuous dual-arc geometry with rounded caps that retains high contrast and legibility at sub-32px sizes.

### 4. `on_dark`
- **Use for**: Dark mode web themes, developer consoles, terminal CLI badges, dark slide decks.
- **Properties**: High-contrast luminous dots that maintain legibility against dark slate surfaces (`#0F172A`).

### 5. `mono_black` & `mono_white`
- **Use for**: Invoices, receipts, black & white laser printing, laser engraving, rubber stamps, single-color embroidery.

### 6. `horizontal_lockup`
- **Use for**: Website navigation headers, desktop software titles, email signatures, horizontal document banners.

### 7. `stacked_lockup`
- **Use for**: App onboarding, software splash screens, book/thesis covers, conference posters, title slides.
