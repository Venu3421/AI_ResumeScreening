---
name: InterviewIQ AI
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#632ecd'
  on-tertiary: '#ffffff'
  tertiary-container: '#7d4ce7'
  on-tertiary-container: '#f6edff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  section-gap: 80px
---

## Brand & Style
The design system is engineered to evoke a sense of intelligent precision and effortless sophistication. It targets high-growth tech companies and ambitious professionals, blending the clinical efficiency of a developer tool with the high-end polish of a luxury SaaS product. 

The aesthetic is rooted in **Modern Minimalism** with a **Futuristic Glassmorphic** layer. It prioritizes clarity through generous whitespace and a "light-first" approach, utilizing depth and translucency to organize complex AI-driven data. The interface should feel breathable yet dense with information, achieved through micro-interactions and subtle depth cues that suggest the software is "thinking" alongside the user.

## Colors
The palette is centered on a "Professional Intelligence" spectrum. The **Deep Blue** provides a foundation of trust, while the **Indigo** and **Purple** accents are reserved specifically for AI-driven insights, scoring, and magical moments. 

- **Surfaces:** Use `#ffffff` for primary content cards and `#f9fafb` for the main background to create subtle contrast.
- **Gradients:** Use linear gradients (135°) transitioning from Primary to Tertiary for high-impact CTAs and AI progress indicators.
- **Semantic Colors:** Emerald, Amber, and Rose should be used at low saturation for backgrounds (e.g., alert banners) and high saturation for iconography and status pips.

## Typography
The typography system utilizes **Inter** for its neutral, highly legible characteristics in both headlines and body copy. For headlines, we employ tight tracking (letter-spacing) to achieve a modern, "impactful" look similar to leading developer tools. 

**Geist** is introduced as a secondary font for labels and technical data, providing a monospaced-adjacent feel that reinforces the "AI" and "Data" nature of the platform. All type should prioritize vertical rhythm, using a base 4px grid for line-height increments.

## Layout & Spacing
This design system uses a **Fluid 12-column grid** for desktop and a **single-column stack** for mobile. 

- **Horizontal Rhythm:** Use a 24px gutter between columns. Content should be centered within a 1280px max-width container.
- **Vertical Rhythm:** A "Scale of 8" (8, 16, 24, 32, 48, 64, 80) must be used for all margins and paddings to ensure mathematical harmony.
- **Mobile Reflow:** Elements should transition from multi-column grids to vertical stacks at 768px. Sidebars on desktop should convert to bottom-sheet drawers or hidden off-canvas menus on mobile.

## Elevation & Depth
Depth is created through a combination of **Glassmorphism** and **Ambient Shadows**.

1.  **Level 0 (Floor):** The background (#f9fafb) with subtle radial gradients of soft purple in the corners.
2.  **Level 1 (Cards):** Pure white background with a 1px stroke (#e2e8f0) and a very soft, large-radius shadow: `0 10px 25px -5px rgba(0, 0, 0, 0.04)`.
3.  **Level 2 (Floating Nav/Modals):** Backdrop blur (20px) with a semi-transparent white fill (70% opacity). Borders should be 1px solid white (20% opacity) to create a "shimmer" effect on the edge.
4.  **Level 3 (AI Insights):** Elements using a subtle Indigo-tinted shadow to denote intelligence-driven content.

## Shapes
The system utilizes a "High-Radius" philosophy to feel approachable and modern. 

- **Primary Cards:** Use `rounded-2xl` (1rem) as the standard.
- **Main Action Containers:** Use `rounded-3xl` (1.5rem) to differentiate high-level sections or dashboard widgets.
- **Buttons & Inputs:** Use `rounded-lg` (0.5rem) for a precise, clickable feel that contrasts slightly with the softer outer containers.
- **Status Pills:** Always fully rounded (pill-shaped) to distinguish them from interactive buttons.

## Components

### Floating Navigation
A fixed-position header with a `20px` backdrop-blur and a subtle `1px` bottom border. Use a centered layout for top-level links and a right-aligned section for the "Dashboard" CTA.

### Gradient Buttons
Primary buttons should use a linear gradient from Primary Blue to Indigo. Hover states should increase the gradient intensity and apply a `4px` translateY lift. 

### Data Tables & Charts
Tables must be borderless with light-grey row dividers. Headers should use `label-sm` in all-caps Geist. Charts (Area/Bar) should use the Tertiary Purple for data trends with a soft glow effect on data points.

### Loading Skeletons
Instead of spinners, use shimmering skeleton states that mimic the layout of the final data. The shimmer should move from left to right in a 1.5s ease-in-out loop.

### File Upload Area
A dashed-border container (`rounded-2xl`) using a light Blue-Neutral background. On drag-over, the border should transition to a solid Indigo stroke with a slight scale-up animation of the upload icon.

### Score Indicators
Circular progress indicators for "Interview Readiness." Use a thick stroke with a gradient path (Emerald for high scores, Amber for medium). The center of the circle should display the score in `headline-md`.