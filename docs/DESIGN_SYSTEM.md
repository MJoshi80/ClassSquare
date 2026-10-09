# ClassSquare UI/UX & Clean Interface Guidelines

Follow these design and layout principles when building or updating any user-facing components:

## 1. Action Consolidation & Decluttering
- **Three-Dot Menu for Secondary Actions:** Do not crowd toolbars, filter bars, or table headers with multiple individual export/utility buttons (e.g., Sync, Excel, CSV, Print). Consolidate them into an integrated three-dot menu (`⋮` / `MoreVerticalIcon`) with a quick-action dropdown and modal overview dialog.
- **Workflow Tiering:** Keep primary decision workflows (e.g., Approve, Reject, Save, Generate) visually distinct and separated from secondary data utilities (e.g., Export, Download, Print).
- **Clean Filter Bars:** Keep top-level selector strips focused exclusively on context switching (e.g., Department, Semester, Batch) without loose action buttons.

## 2. Icon Sizing & Scaling Invariants
- **Prop Propagation in Icons:** All custom SVG icon components must forward `{ className, style, ...props }` to ensure container styles and Material UI wrapper dimensions are never silently dropped.
- **Chip & Badge Icons:** Inline icons inside chips, status tags, and table badges must never exceed `13px-15px` (`width` and `height`). Always verify with theme overrides or utility classes.
- **Empty States & Headers:** Use uniform squircle containers (e.g., 40–44px, `#f1f5f9`) housing `w-5 h-5` (20px) icons rather than unconstrained raw SVG illustrations.
- **Zero Emoji Vector Policy:** Use purely mathematical vector SVGs matching the design language. Never use raw Unicode emojis in UI controls.

## 3. Dense Grid & Timetable Spacing
- **Generous Dimensions:** Ensure timetable slot cells maintain at least `min-w-[195px]` width and `h-[125px]` height on desktop viewports to prevent course code, faculty name, and room badge collisions.
- **Free Slot Treatment:** Style unallocated or free study gap slots with distinct, soft visual treatments (e.g., subtle dotted border, muted icon badge) to make schedule gaps immediately recognizable.
- **Print Optimization:** Always preserve compact `print:` utility overrides (e.g., `print:w-[15%]`, `print:min-w-0`) to ensure multi-column grids fit within a single vertical A4 page when printed.

## 4. Scrollbar & Overflow Hygiene
- **Horizontal Chip Streams:** Whenever horizontal scrolling is enabled for tag/chip strips (such as course streams or subject filters), always hide native browser scrollbars using:
  ```javascript
  sx={{
    overflowX: 'auto',
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
  }}
  ```
- **Flex Wrap Prevention:** Guard multi-element header action groups against unexpected line wrapping on standard desktop screens (>= 1280px) using `flexShrink: 0` or structured two-tier grouping.
