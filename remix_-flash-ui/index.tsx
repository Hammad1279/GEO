/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

//Vibe coded by ammaar@google.com

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation, LayoutOption } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId } from './utils';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import { 
    ThinkingIcon, 
    CodeIcon, 
    SparklesIcon, 
    ArrowLeftIcon, 
    ArrowRightIcon, 
    ArrowUpIcon, 
    GridIcon 
} from './components/Icons';

interface ParsedArtifactResult {
  title: string;
  html: string;
  status: 'streaming' | 'complete' | 'error';
}

const parseSingleRequestStream = (buffer: string): ParsedArtifactResult[] => {
  const results: ParsedArtifactResult[] = [
    { title: '', html: '', status: 'streaming' },
    { title: '', html: '', status: 'streaming' },
    { title: '', html: '', status: 'streaming' },
  ];

  for (let i = 0; i < 3; i++) {
    const startMarker = `[VARIATION_${i + 1}_START]`;
    const endMarker = `[VARIATION_${i + 1}_END]`;

    const startIndex = buffer.indexOf(startMarker);
    if (startIndex === -1) {
      continue;
    }

    const contentStart = startIndex + startMarker.length;
    const endIndex = buffer.indexOf(endMarker, contentStart);

    let content = '';
    let isComplete = false;
    if (endIndex !== -1) {
      content = buffer.substring(contentStart, endIndex);
      isComplete = true;
    } else {
      content = buffer.substring(contentStart);
    }

    const titleIndex = content.indexOf('TITLE:');
    const htmlIndex = content.indexOf('HTML:');

    if (titleIndex !== -1) {
      const titleEnd = htmlIndex !== -1 ? htmlIndex : content.length;
      let rawTitle = content.substring(titleIndex + 6, titleEnd).trim();
      results[i].title = rawTitle;
    }

    if (htmlIndex !== -1) {
      let rawHtml = content.substring(htmlIndex + 5);
      let cleanedHtml = rawHtml.trim();

      if (cleanedHtml.startsWith('```html')) {
        cleanedHtml = cleanedHtml.substring(7).trimStart();
      } else if (cleanedHtml.startsWith('```')) {
        cleanedHtml = cleanedHtml.substring(3).trimStart();
      }

      if (cleanedHtml.endsWith('```')) {
        cleanedHtml = cleanedHtml.substring(0, cleanedHtml.length - 3).trimEnd();
      } else {
        cleanedHtml = cleanedHtml.replace(/```$/, '').trim();
      }

      results[i].html = cleanedHtml;
    }

    results[i].status = isComplete ? 'complete' : 'streaming';
  }

  return results;
};

interface OverlayTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  previewImage: string;
  defaultScript: string;
  promptTemplate: string;
}

const OVERLAY_TEMPLATES: OverlayTemplate[] = [
  {
    id: 'coral_stat_callout',
    title: 'Coral Stat Callout',
    description: 'Highlight key statistics, metrics, or percentages with elegant frame-accurate timing bars.',
    icon: '📊',
    previewImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80',
    defaultScript: 'Our conservation program resulted in a massive 42% growth in wildlife populations over just eighteen months.',
    promptTemplate: `Style Name: Coral Stat Callout
Design System Focus: Styrene-style bold sans-serif numbers (size 64px-96px), lowercase or uppercase tracked small labels underneath, terracotta horizontal indicator line, high-contrast cream tag card that fades and springs in elegantly. Must extract a relevant statistic or percentage from the script (e.g., '42%') to use as the prominent large number, and a relevant summary title label (e.g., 'WILDLIFE POPULATION GROWTH') underneath.`
  },
  {
    id: 'editorial_quote',
    title: 'Editorial Quote Highlight',
    description: 'An elegant italicized quotation card designed to present dialogue or narrational voiceovers in a premium journalistic style.',
    icon: '💬',
    previewImage: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=800&q=80',
    defaultScript: '"The depth of the canyon is not merely geological; it holds centuries of unwritten human stories." — Senior Forest Ranger',
    promptTemplate: `Style Name: Editorial Quote Highlight
Design System Focus: Tiempos-style serif italic body font for quote text, small uppercase sans-serif label for the author, warm cream background card with left border-accent in coral color (#DA7756). Extract an engaging quotation sentence from the script and attribute it beautifully.`
  },
  {
    id: 'lower_third',
    title: 'Warm Lower-Third Tag',
    description: 'A classic broadcast/documentary overlay positioned in the lower-left corner to introduce speakers, titles, or active locations.',
    icon: '👤',
    previewImage: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=800&q=80',
    defaultScript: 'Dr. Evelyn Mercer, Lead Oceanographer reporting live from the North Sea Expedition Vessel.',
    promptTemplate: `Style Name: Warm Lower-Third Tag
Design System Focus: Broad-safe margins, bottom-left positioning. Semi-transparent warm scrim backdrop. Name in clean Styrene sans-serif bold, subtitle in Tiempos italic or muted uppercase sans-serif. Left border accent indicator. Extract or formulate a speaker's name, role, and location based on the script.`
  },
  {
    id: 'badge_chip',
    title: 'Research Badge Chip',
    description: 'A compact and modern badge chip positioned in the upper corner to categorize segments, current topics, or study subjects.',
    icon: '🏷️',
    previewImage: 'https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=800&q=80',
    defaultScript: 'Initiating Phase 04 of our deep forest study. All telemetry readings are within expected margins.',
    promptTemplate: `Style Name: Research Badge Chip
Design System Focus: Pill-shaped or small card structure at top-left or top-right. Highlight tracking (uppercase letter-spacing 0.12em), coral-light tag background, terracotta text label. Extract a short 2-3 word uppercase metadata category identifier (e.g., 'PHASE 04 / FIELD STUDY').`
  },
  {
    id: 'danger_warning',
    title: 'Danger Warning Overlay',
    description: 'A clean and high-visibility notification banner to call out critical concerns, emergency notes, or hazardous footage environments.',
    icon: '⚠️',
    previewImage: 'https://images.unsplash.com/photo-1506013013546-f461104d11fd?auto=format&fit=crop&w=800&q=80',
    defaultScript: 'Warning: High radiation hazard detected beyond the safety perimeter. Instant evacuation advised.',
    promptTemplate: `Style Name: Danger Warning Overlay
Design System Focus: Emergency banner pattern. Structured border, semantic alert colors (#D84C4C crimson on #FDF2F2 background). Centered or anchored tag with warning icon representation in styled vector. Extract the main caution/alarm text cleanly.`
  },
  {
    id: 'map_location',
    title: 'Geological Map Pin Locator',
    description: 'A geographical coordinate locator with a pulsing target marker to pinpoint coordinates and locations on the active b-roll shot.',
    icon: '📍',
    previewImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80',
    defaultScript: 'Our research outpost is established deep inside the Annapurna Circuit in Nepal, at an elevation of 4,800m.',
    promptTemplate: `Style Name: Geological Map Pin Locator
Design System Focus: Location pin with coordinates. Custom geographic layout styling, semantic coordinate lettering in JetBrains Mono font, small pulsing circular target locator on the video frame. Extract the place name or country, and invent/deduce highly realistic decimal latitude and longitude coordinates.`
  }
];

const CURATED_BACKGROUNDS = [
  { id: 'desert_oasis', name: 'Desert Oasis', url: 'https://images.unsplash.com/photo-1509316975850-ff9c5edd0cd9?auto=format&fit=crop&w=1600&q=80' },
  { id: 'forest_mist', name: 'Forest Mist', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80' },
  { id: 'retro_workspace', name: 'Retro Workspace', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80' },
  { id: 'moody_studio', name: 'Moody Studio', url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1600&q=80' },
  { id: 'ocean_drift', name: 'Ocean Drift', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1600&q=80' },
  { id: 'cyberpunk_alley', name: 'Neon Cyberpunk', url: 'https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?auto=format&fit=crop&w=1600&q=80' }
];

const injectCustomBackground = (html: string, backgroundUrl: string, motionDuration: number = 10) => {
  if (!html) return '';
  let processed = html;
  processed = processed.replace(/https:\/\/simulated-video-frame-background\.jpg/g, backgroundUrl);
  processed = processed.replace(/https:\/\/picsum\.photos\/[^\s'"`<>]+/g, backgroundUrl);

  const styleInjection = `
<style id="motion-duration-override">
  /* Force hide scrollbars / sliders inside the frame */
  html, body {
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background-color: #000000 !important;
  }

  /* Make sure container has overflow hidden and a solid black background to pillarbox/letterbox beautifully */
  .background-photo-layer,
  .broll-background,
  div[class*="background"],
  div[class*="broll"] {
    overflow: hidden !important;
    position: absolute !important;
    inset: 0 !important;
    background-color: #000000 !important;
  }

  @keyframes broll-zoom-pan {
    0% {
      opacity: 0.96;
      filter: brightness(0.98) saturate(1);
    }
    50% {
      opacity: 1;
      filter: brightness(1.04) saturate(1.02);
    }
    100% {
      opacity: 0.96;
      filter: brightness(0.98) saturate(1);
    }
  }
  
  /* Target any background image inside the frame to slow-pan/zoom it based on motion duration */
  img[src*="${backgroundUrl}"], 
  img[src*="simulated-video-frame-background"], 
  img[src*="unsplash.com"], 
  img[src*="picsum.photos"],
  .background-photo-layer img,
  .broll-background img,
  img[class*="background"],
  img[class*="broll"] {
    animation: broll-zoom-pan ${motionDuration}s ease-in-out infinite !important;
    transform-origin: center center !important;
    object-fit: contain !important;
    background-color: #000000 !important;
    width: 100% !important;
    height: 100% !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    margin: auto !important;
  }
</style>
`;

  if (processed.includes('</head>')) {
    processed = processed.replace('</head>', `${styleInjection}</head>`);
  } else if (processed.includes('</body>')) {
    processed = processed.replace('</body>', `${styleInjection}</body>`);
  } else {
    processed = processed + styleInjection;
  }

  return processed;
};

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.1-flash-lite' | 'gemini-3.5-flash'>('gemini-3.1-flash-lite');

  // NEW WORKFLOW STATES
  const [activeView, setActiveView] = useState<'library' | 'studio'>('library');
  const [selectedTemplate, setSelectedTemplate] = useState<OverlayTemplate | null>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [scriptText, setScriptText] = useState<string>('');
  const [imageSourceType, setImageSourceType] = useState<'curated' | 'upload' | 'url'>('curated');
  const [selectedBrollId, setSelectedBrollId] = useState<string>('desert_oasis');
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [motionDuration, setMotionDuration] = useState<number>(10);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      inputRef.current?.focus();
  }, []);

  // Fix for mobile: reset scroll when focusing an item to prevent "overscroll" state
  useEffect(() => {
    if (focusedArtifactIndex !== null && window.innerWidth <= 1024) {
        if (gridScrollRef.current) {
            gridScrollRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
    }
  }, [focusedArtifactIndex]);

  // Cycle placeholders
  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 3000);
      return () => clearInterval(interval);
  }, [placeholders.length]);

  // Dynamic placeholder generation on load
  useEffect(() => {
      const fetchDynamicPlaceholders = async () => {
          try {
              const response = await fetch('/api/gemini/placeholders');
              if (!response.ok) return;
              const data = await response.json();
              const text = data.text || '[]';
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                  const newPlaceholders = JSON.parse(jsonMatch[0]);
                  if (Array.isArray(newPlaceholders) && newPlaceholders.length > 0) {
                      const shuffled = newPlaceholders.sort(() => 0.5 - Math.random()).slice(0, 10);
                      setPlaceholders(prev => [...prev, ...shuffled]);
                  }
              }
          } catch (e) {
              console.warn("Silently failed to fetch dynamic placeholders", e);
          }
      };
      setTimeout(fetchDynamicPlaceholders, 1000);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const parseJsonStream = async function* (responseStream: AsyncGenerator<{ text: string }>) {
      let buffer = '';
      for await (const chunk of responseStream) {
          const text = chunk.text;
          if (typeof text !== 'string') continue;
          buffer += text;
          let braceCount = 0;
          let start = buffer.indexOf('{');
          while (start !== -1) {
              braceCount = 0;
              let end = -1;
              for (let i = start; i < buffer.length; i++) {
                  if (buffer[i] === '{') braceCount++;
                  else if (buffer[i] === '}') braceCount--;
                  if (braceCount === 0 && i > start) {
                      end = i;
                      break;
                  }
              }
              if (end !== -1) {
                  const jsonString = buffer.substring(start, end + 1);
                  try {
                      yield JSON.parse(jsonString);
                      buffer = buffer.substring(end + 1);
                      start = buffer.indexOf('{');
                  } catch (e) {
                      start = buffer.indexOf('{', start + 1);
                  }
              } else {
                  break; 
              }
          }
      }
  };

  const getSelectedBackgroundImage = useCallback(() => {
    if (imageSourceType === 'curated') {
      const bg = CURATED_BACKGROUNDS.find(b => b.id === selectedBrollId);
      return bg ? bg.url : CURATED_BACKGROUNDS[0].url;
    } else if (imageSourceType === 'upload') {
      return uploadedBase64 || CURATED_BACKGROUNDS[0].url;
    } else {
      return customImageUrl || CURATED_BACKGROUNDS[0].url;
    }
  }, [imageSourceType, selectedBrollId, uploadedBase64, customImageUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setUploadedBase64(uploadEvent.target.result as string);
          setImageSourceType('upload');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setUploadedBase64(uploadEvent.target.result as string);
          setImageSourceType('upload');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateCustomOverlay = useCallback(async (template: OverlayTemplate) => {
    const trimmedScript = scriptText.trim() || template.defaultScript;
    setIsLoading(true);
    setActiveView('studio');
    setIsCustomizerOpen(false);

    const baseTime = Date.now();
    const sessionId = generateId();

    const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Analyzing Script...',
        html: '',
        status: 'streaming',
    }));

    const newSession: Session = {
        id: sessionId,
        prompt: `Template: ${template.title} | Script: "${trimmedScript}"`,
        timestamp: baseTime,
        artifacts: placeholderArtifacts
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length); 
    setFocusedArtifactIndex(null); 

    try {
        const prompt = `
You are Motion Studio, a world-class motion designer who builds ON-SCREEN VIDEO OVERLAY GRAPHICS for video editors — the kind of text/graphic overlays a documentary or educational YouTube video drops on top of b-roll footage.

Your task is to generate EXACTLY 3 DISTINCT, RADICAL, HIGH-FIDELITY VIDEO OVERLAY GRAPHIC variations/treatments for the following request.
Selected Template Style Type: ${template.title}
Detailed Style Guidelines:
${template.promptTemplate}

Narration Script Snippet provided by the user:
"${trimmedScript}"

Each variation must follow the detailed style guidelines and the mandatory design system below, and have its own unique animation behavior (e.g. sequence staggering, slightly different typography scale, or layout alignment variation matching that persona).

**MANDATORY CONTENT INTEGRATION (CRITICAL):**
You MUST parse the user's Narration Script Snippet ("${trimmedScript}") and extract/formulate the content of the overlay. Do not display generic placeholder text (like "Lorem Ipsum" or "Title goes here"). You must adapt the text to directly relate to the user's script snippet:
- For 'Coral Stat Callout': find a statistic, percentage, or number (e.g. '42%', '10,000', 'Phase 3') inside the script, and make that the primary giant text, with a supporting descriptive summary.
- For 'Editorial Quote Highlight': extract a memorable quote phrase or key statement from the script, with an attribution label.
- For 'Warm Lower-Third Tag': identify a speaker name, title/role, and location mentioned or implied, and present it clearly.
- For 'Research Badge Chip': formulate a clean, uppercase 2-3 word topic classification or chapter marker.
- For 'Danger Warning Overlay': capture the primary warning or hazard warning context.
- For 'Geological Map Pin Locator': identify the geographic location or country, and formulate highly realistic decimal lat/long coordinates.

**MANDATORY DESIGN SYSTEM (Anthropic/Claude visual language — every overlay MUST follow this exactly, no exceptions):**
- Colors: warm cream #FAF9F5 / #F5F3ED for any label or card chrome background (never pure white #FFFFFF, never cool/blue-tinted gray). Text: #1F1915 (primary), #4D463E (body), #6B6359 (tertiary), #B5AFA5 (placeholder/muted).
- Accent: coral #DA7756 and terracotta #C4553D are the ONLY accent colors, used sparingly (an accent bar, a highlighted word, a badge background). Coral-light #F5DDD4 for subtle tinted backgrounds.
- Semantic colors ONLY when the content calls for it: danger/warning overlays use #D84C4C on #FDF2F2, success uses #3D8B6E on #F0F7F4, info/location uses #4A7FB5 on #F0F5FA.
- Typography: sans-serif stack \`'Inter',-apple-system,'Segoe UI',sans-serif\` for headlines/labels/numbers; serif stack \`Georgia,serif\` for any quote/caption pulled text (italic). Headlines use tight tracking (-0.01 to -0.02em), labels use wide uppercase tracking (0.06-0.08em).
- Shape: 8-16px border-radius on cards/labels, pill/9999px only for small tag chips. Borders \`1px solid #EBE8E2\` (subtle) or \`1px solid #DDD9D1\` (strong). Callout cards may use a \`border-left: 3px solid #DA7756\` accent (Anthropic's "research card" pattern).
- Depth: shadows are subtle and warm-tinted only, e.g. \`0 4px 12px rgba(31,25,21,0.08)\` — never heavy black drop shadows.
- Motion: CALM and editorial, matching Anthropic's explicit "avoid aggressive animations" principle — achieved here through REMOTION-STYLE motion engineering (see below), not through bounce or flash.

**REMOTION-INSPIRED MOTION ENGINEERING (apply these principles when writing the CSS/JS, even though the output is plain HTML/CSS/JS, not the Remotion library itself):**
1. **Think in frames, not vague ms**: assume a 30fps timeline. Convert every duration/delay to a frame-accurate multiple of ~33.33ms (e.g. 300ms = 9 frames, 450ms = ~14 frames) so the motion would line up cleanly if scrubbed frame-by-frame in a video editor.
2. **Spring, not linear ease**: implement entrances using a critically/over-damped spring curve (high damping, e.g. \`cubic-bezier(0.22, 1, 0.36, 1)\` or a small JS spring function with damping ≈ 200, stiffness ≈ 100, mass ≈ 1) instead of default \`ease\`/\`linear\`. High damping means the spring settles smoothly with NO overshoot/bounce — physically natural, calm, and Anthropic-compliant at the same time.
3. **interpolate(), clamped**: any value driven by scroll/time/frame progress should be computed like Remotion's \`interpolate(frame, [inputStart, inputEnd], [outputStart, outputEnd])\` with clamping at both ends — i.e. explicitly clamp the animated value so it never overshoots its target range.
4. **Deterministic only — never \`Math.random()\`**: if any per-element variation is needed (stagger offsets, slight rotation, position jitter), use fixed hand-picked values or a simple deterministic formula seeded by the element's index — never runtime randomness — so the animation renders identically every single time, like a real Remotion composition would.
5. **Sequence-style staggering**: when multiple elements enter (e.g. a label then a number then a caption), give each one an explicit frame-based offset (like Remotion's \`Series.Sequence offset\`) — e.g. element 2 starts exactly N frames after element 1 — rather than eyeballed/random delays.
6. **Layered composition (AbsoluteFill-style)**: structure the overlay as explicit stacked full-bleed layers — a background photo layer, a scrim/gradient layer, and a content layer — each as its own \`position:absolute; inset:0\` div stacked by z-index, mirroring how a Remotion \`<AbsoluteFill>\` stack works.

**VIDEO-FRAME EXECUTION RULES:**
1. **Simulate a real video frame**: outer container is a 16:9 frame, \`overflow:hidden\`, position: relative.
2. **THE CORE REQUIREMENT**: The background image \`<img>\` tag inside the background absolute layer MUST use EXACTLY the following URL: \`https://simulated-video-frame-background.jpg\`. Do NOT use any other URL or variable for the background.
3. **Legibility scrim**: add a subtle gradient scrim (e.g. \`linear-gradient(to top, rgba(31,25,21,0.55), transparent 40%)\`) behind any overlay text so it stays readable over the photo, without covering the whole frame.
4. **Broadcast-safe placement**: position the overlay (lower-third, corner tag, stat callout, banner, etc.) with realistic margins (roughly 5-8% inset from frame edges) — the way a real video editor would place a caption or graphic.
5. **The photo is the footage, the graphic is the overlay**: only the label/card/text chrome should use the Anthropic cream/coral palette — the background photo itself stays untouched/real.
6. **Self-contained loop**: the overlay should animate in once and then hold (or loop a subtle single accent detail), so it reads correctly as a still frame grabbed mid-animation for video editing reference.

**IP SAFEGUARD**: No artist names, brand names, or trademarks in visible text.

**OUTPUT STRUCTURAL RULES (CRITICAL):**
You MUST output the 3 variations sequentially, wrapped in the following exact markers. Do not include any other markdown outside these markers, and don't place markdown codeblocks around the markers. Ensure the HTML block itself is valid raw HTML/CSS/JS.

[VARIATION_1_START]
TITLE: <Unique persona name for overlay pattern 1 (e.g. "Coral Stat Callout")>
HTML:
<HTML, inline style, and script tags for variation 1>
[VARIATION_1_END]

[VARIATION_2_START]
TITLE: <Unique persona name for overlay pattern 2 (e.g. "Editorial Quote Highlight")>
HTML:
<HTML, inline style, and script tags for variation 2>
[VARIATION_2_END]

[VARIATION_3_START]
TITLE: <Unique persona name for overlay pattern 3 (e.g. "Warm Lower-Third Tag")>
HTML:
<HTML, inline style, and script tags for variation 3>
[VARIATION_3_END]
        `.trim();

        const response = await fetch('/api/gemini/generate-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model: selectedModel }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Response stream is not readable.");

        const decoder = new TextDecoder();
        let accumulatedText = '';
        let streamBuffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            streamBuffer += decoder.decode(value, { stream: true });
            const lines = streamBuffer.split('\n');
            streamBuffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.text) {
                            accumulatedText += parsed.text;
                            const parsedResults = parseSingleRequestStream(accumulatedText);
                            
                            setSessions(prev => prev.map(sess => 
                                sess.id === sessionId ? {
                                    ...sess,
                                    artifacts: sess.artifacts.map((art, i) => {
                                        const parsedArt = parsedResults[i];
                                        return {
                                            ...art,
                                            styleName: parsedArt.title ? parsedArt.title.trim() : (art.styleName && art.styleName !== 'Analyzing Script...' ? art.styleName : `Variation ${i + 1}`),
                                            html: parsedArt.html,
                                            status: parsedArt.status
                                        };
                                    })
                                } : sess
                            ));
                        }
                    } catch (e) {
                        console.error("Error parsing JSON chunk:", e);
                    }
                }
            }
        }

        const finalParsed = parseSingleRequestStream(accumulatedText);
        setSessions(prev => prev.map(sess => 
            sess.id === sessionId ? {
                ...sess,
                artifacts: sess.artifacts.map((art, i) => {
                    const parsed = finalParsed[i];
                    const finalHtml = parsed.html || art.html;
                    return {
                        ...art,
                        styleName: parsed.title ? parsed.title.trim() : (art.styleName && art.styleName !== 'Analyzing Script...' ? art.styleName : `Variation ${i + 1}`),
                        html: finalHtml,
                        status: finalHtml ? 'complete' : 'error' as const
                    };
                })
            } : sess
        ));

    } catch (e) {
        console.error("Fatal error in generation process", e);
        setSessions(prev => prev.map(sess => 
            sess.id === sessionId ? {
                ...sess,
                artifacts: sess.artifacts.map(art => ({
                    ...art,
                    html: `<div style="color: #ff6b6b; padding: 20px;">Error: ${e instanceof Error ? e.message : 'Unknown error occurred'}</div>`,
                    status: 'error' as const
                }))
            } : sess
        ));
    } finally {
        setIsLoading(false);
    }
  }, [scriptText, sessions.length, selectedModel]);

  const handleGenerateVariations = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

    setIsLoading(true);
    setComponentVariations([]);
    setDrawerState({ isOpen: true, mode: 'variations', title: 'Variations', data: currentArtifact.id });

    try {
        const prompt = `
You are a master video-overlay graphic designer working strictly within Anthropic's design system. Generate 3 RADICAL VARIATIONS of the video overlay graphic: "${currentSession.prompt}".

**MANDATORY DESIGN SYSTEM (non-negotiable for all 3 variations):**
Warm cream #FAF9F5/#F5F3ED chrome backgrounds (never pure white, never cool gray), coral #DA7756 / terracotta #C4553D as the only accent, warm charcoal text (#1F1915/#4D463E), Styrene-style sans-serif for labels/numbers + Tiempos-style serif italic for quotes, 8-16px radii, subtle warm shadows. The overlay sits on top of a real background photo (b-roll) with a legibility scrim — the photo itself is not restyled, only the overlay chrome is.

**MANDATORY MOTION SYSTEM (Remotion-inspired, non-negotiable):**
Think in a 30fps frame grid (durations/delays as frame-accurate multiples of ~33.33ms). Use high-damping spring easing (no overshoot/bounce — e.g. \`cubic-bezier(0.22, 1, 0.36, 1)\`), clamp any interpolated value to its output range, stagger multiple elements with explicit frame-based offsets (not random delays), and NEVER use \`Math.random()\` — any variation must be deterministic/fixed so the animation is frame-perfect and reproducible every time.

**STRICT IP SAFEGUARD:**
No names of artists or brands.

**YOUR TASK — vary the overlay COMPONENT PATTERN, not the color system:**
1. Example: "Stat Callout" (big bold number/headline + small caption, terracotta accent bar).
2. Example: "Lower-Third Tag" (bottom-left location/name label, dark scrim behind, coral left-border).
3. Example: "Quote Highlight Card" (small italic serif caption in a coral-light card, like a pulled narration line).
4. Example: "Research Badge Chip" (small pill tag/category label, coral-light bg, terracotta uppercase tracked text).

For EACH variation:
- Invent a unique persona name for the overlay pattern used.
- Build it as a realistic video frame (16:9 or 9:16 as appropriate) with a picsum.photos background image standing in for the b-roll, a subtle gradient scrim, and the overlay positioned at broadcast-safe margins.
- Generate high-fidelity, self-contained HTML/CSS/JS that animates in calmly and holds.

Required JSON Output Format (stream ONE object per line):
\`{ "name": "Persona Name", "html": "..." }\`
        `.trim();

        const response = await fetch('/api/gemini/generate-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model: selectedModel, temperature: 1.2 }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let streamBuffer = '';

        async function* makeTextStream() {
            while (true) {
                const { value, done } = await reader!.read();
                if (done) break;

                streamBuffer += decoder.decode(value, { stream: true });
                const lines = streamBuffer.split('\n');
                streamBuffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.text) {
                                yield { text: parsed.text };
                            }
                        } catch (e) {
                            console.error("Error parsing JSON chunk:", e);
                        }
                    }
                }
            }
        }

        for await (const variation of parseJsonStream(makeTextStream())) {
            if (variation.name && variation.html) {
                setComponentVariations(prev => [...prev, variation]);
            }
        }
    } catch (e: any) {
        console.error("Error generating variations:", e);
    } finally {
        setIsLoading(false);
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex, selectedModel]);

  const applyVariation = (html: string) => {
      if (focusedArtifactIndex === null) return;
      setSessions(prev => prev.map((sess, i) => 
          i === currentSessionIndex ? {
              ...sess,
              artifacts: sess.artifacts.map((art, j) => 
                j === focusedArtifactIndex ? { ...art, html, status: 'complete' } : art
              )
          } : sess
      ));
      setDrawerState(s => ({ ...s, isOpen: false }));
  };

  const handleShowCode = () => {
      const currentSession = sessions[currentSessionIndex];
      if (currentSession && focusedArtifactIndex !== null) {
          const artifact = currentSession.artifacts[focusedArtifactIndex];
          setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: artifact.html });
      }
  };

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    
    if (!trimmedInput || isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    const baseTime = Date.now();
    const sessionId = generateId();

    const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Designing...',
        html: '',
        status: 'streaming',
    }));

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: baseTime,
        artifacts: placeholderArtifacts
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length); 
    setFocusedArtifactIndex(null); 

    try {
        const prompt = `
You are Motion Studio, a world-class motion designer who builds ON-SCREEN VIDEO OVERLAY GRAPHICS for video editors — the kind of text/graphic overlays a documentary or educational YouTube video drops on top of b-roll footage (stat callouts, lower-thirds, quote captions, warning banners, tag chips, map pin labels, comparison labels).

Your task is to generate EXACTLY 3 DISTINCT, RADICAL, HIGH-FIDELITY VIDEO OVERLAY GRAPHIC variations/treatments for the following request:
"${trimmedInput}"

Each variation must be built from Anthropic's actual design system, have its own unique layout pattern/persona name, and include realistic 16:9 simulated video frame backgrounds with motion that is calm, frame-accurate, and elegant.

**MANDATORY DESIGN SYSTEM (Anthropic/Claude visual language — every overlay MUST follow this exactly, no exceptions):**
- Colors: warm cream #FAF9F5 / #F5F3ED for any label or card chrome background (never pure white #FFFFFF, never cool/blue-tinted gray). Text: #1F1915 (primary), #4D463E (body), #6B6359 (tertiary), #B5AFA5 (placeholder/muted).
- Accent: coral #DA7756 and terracotta #C4553D are the ONLY accent colors, used sparingly (an accent bar, a highlighted word, a badge background). Coral-light #F5DDD4 for subtle tinted backgrounds.
- Semantic colors ONLY when the content calls for it: danger/warning overlays use #D84C4C on #FDF2F2, success uses #3D8B6E on #F0F7F4, info/location uses #4A7FB5 on #F0F5FA.
- Typography: sans-serif stack \`'Styrene A','Styrene B',-apple-system,'Segoe UI',sans-serif\` for headlines/labels/numbers; serif stack \`'Tiempos Text',Georgia,serif\` for any quote/caption pulled text (italic). Headlines use tight tracking (-0.01 to -0.02em), labels use wide uppercase tracking (0.06-0.08em).
- Shape: 8-16px border-radius on cards/labels, pill/9999px only for small tag chips. Borders \`1px solid #EBE8E2\` (subtle) or \`1px solid #DDD9D1\` (strong). Callout cards may use a \`border-left: 3px solid #DA7756\` accent (Anthropic's "research card" pattern).
- Depth: shadows are subtle and warm-tinted only, e.g. \`0 4px 12px rgba(31,25,21,0.08)\` — never heavy black drop shadows.
- Motion: CALM and editorial, matching Anthropic's explicit "avoid aggressive animations" principle — achieved here through REMOTION-STYLE motion engineering (see below), not through bounce or flash.

**REMOTION-INSPIRED MOTION ENGINEERING (apply these principles when writing the CSS/JS, even though the output is plain HTML/CSS/JS, not the Remotion library itself):**
1. **Think in frames, not vague ms**: assume a 30fps timeline. Convert every duration/delay to a frame-accurate multiple of ~33.33ms (e.g. 300ms = 9 frames, 450ms = ~14 frames) so the motion would line up cleanly if scrubbed frame-by-frame in a video editor.
2. **Spring, not linear ease**: implement entrances using a critically/over-damped spring curve (high damping, e.g. \`cubic-bezier(0.22, 1, 0.36, 1)\` or a small JS spring function with damping ≈ 200, stiffness ≈ 100, mass ≈ 1) instead of default \`ease\`/\`linear\`. High damping means the spring settles smoothly with NO overshoot/bounce — physically natural, calm, and Anthropic-compliant at the same time.
3. **interpolate(), clamped**: any value driven by scroll/time/frame progress should be computed like Remotion's \`interpolate(frame, [inputStart, inputEnd], [outputStart, outputEnd])\` with clamping at both ends — i.e. explicitly clamp the animated value so it never overshoots its target range.
4. **Deterministic only — never \`Math.random()\`**: if any per-element variation is needed (stagger offsets, slight rotation, position jitter), use fixed hand-picked values or a simple deterministic formula seeded by the element's index — never runtime randomness — so the animation renders identically every single time, like a real Remotion composition would.
5. **Sequence-style staggering**: when multiple elements enter (e.g. a label then a number then a caption), give each one an explicit frame-based offset (like Remotion's \`Series.Sequence offset\`) — e.g. element 2 starts exactly N frames after element 1 — rather than eyeballed/random delays.
6. **Layered composition (AbsoluteFill-style)**: structure the overlay as explicit stacked full-bleed layers — a background photo layer, a scrim/gradient layer, and a content layer — each as its own \`position:absolute; inset:0\` div stacked by z-index, mirroring how a Remotion \`<AbsoluteFill>\` stack works.

**VIDEO-FRAME EXECUTION RULES:**
1. **Simulate a real video frame**: outer container is a 16:9 frame (use 9:16 instead if the prompt clearly implies Shorts/Reels/TikTok vertical content), \`overflow:hidden\`, with a REAL background photo (use \`https://picsum.photos/seed/\${encodeURIComponent(trimmedInput.split(' ').slice(0, 3).join('_'))}_\${i}/1600/900\`) standing in for the b-roll footage — not a plain color background.
2. **Legibility scrim**: add a subtle gradient scrim (e.g. \`linear-gradient(to top, rgba(31,25,21,0.55), transparent 40%)\`) behind any overlay text so it stays readable over the photo, without covering the whole frame.
3. **Broadcast-safe placement**: position the overlay (lower-third, corner tag, stat callout, banner, etc.) with realistic margins (roughly 5-8% inset from frame edges) — the way a real video editor would place a caption or graphic.
4. **The photo is the footage, the graphic is the overlay**: only the label/card/text chrome should use the Anthropic cream/coral palette — the background photo itself stays untouched/real.
5. **Self-contained loop**: the overlay should animate in once and then hold (or loop a subtle single accent detail), so it reads correctly as a still frame grabbed mid-animation for video editing reference.

**IP SAFEGUARD**: No artist names, brand names, or trademarks in visible text.

**OUTPUT STRUCTURAL RULES (CRITICAL):**
You MUST output the 3 variations sequentially, wrapped in the following exact markers. Do not include any other markdown outside these markers, and don't place markdown codeblocks around the markers. Ensure the HTML block itself is valid raw HTML/CSS/JS.

[VARIATION_1_START]
TITLE: <Unique persona name for overlay pattern 1 (e.g. "Coral Stat Callout")>
HTML:
<HTML, inline style, and script tags for variation 1>
[VARIATION_1_END]

[VARIATION_2_START]
TITLE: <Unique persona name for overlay pattern 2 (e.g. "Editorial Quote Highlight")>
HTML:
<HTML, inline style, and script tags for variation 2>
[VARIATION_2_END]

[VARIATION_3_START]
TITLE: <Unique persona name for overlay pattern 3 (e.g. "Warm Lower-Third Tag")>
HTML:
<HTML, inline style, and script tags for variation 3>
[VARIATION_3_END]
        `.trim();

        const response = await fetch('/api/gemini/generate-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model: selectedModel }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Response stream is not readable.");

        const decoder = new TextDecoder();
        let accumulatedText = '';
        let streamBuffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            streamBuffer += decoder.decode(value, { stream: true });
            const lines = streamBuffer.split('\n');
            streamBuffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.text) {
                            accumulatedText += parsed.text;
                            const parsedResults = parseSingleRequestStream(accumulatedText);
                            
                            setSessions(prev => prev.map(sess => 
                                sess.id === sessionId ? {
                                    ...sess,
                                    artifacts: sess.artifacts.map((art, i) => {
                                        const parsed = parsedResults[i];
                                        return {
                                            ...art,
                                            styleName: parsed.title ? parsed.title.trim() : (art.styleName && art.styleName !== 'Designing...' ? art.styleName : `Variation \${i + 1}`),
                                            html: parsed.html,
                                            status: parsed.status
                                        };
                                    })
                                } : sess
                            ));
                        }
                    } catch (e) {
                        console.error("Error parsing JSON chunk:", e);
                    }
                }
            }
        }

        const finalParsed = parseSingleRequestStream(accumulatedText);
        setSessions(prev => prev.map(sess => 
            sess.id === sessionId ? {
                ...sess,
                artifacts: sess.artifacts.map((art, i) => {
                    const parsed = finalParsed[i];
                    const finalHtml = parsed.html || art.html;
                    return {
                        ...art,
                        styleName: parsed.title ? parsed.title.trim() : (art.styleName && art.styleName !== 'Designing...' ? art.styleName : `Variation \${i + 1}`),
                        html: finalHtml,
                        status: finalHtml ? 'complete' : 'error' as const
                    };
                })
            } : sess
        ));

    } catch (e) {
        console.error("Fatal error in generation process", e);
        setSessions(prev => prev.map(sess => 
            sess.id === sessionId ? {
                ...sess,
                artifacts: sess.artifacts.map(art => ({
                    ...art,
                    html: `<div style="color: #ff6b6b; padding: 20px;">Error: \${e instanceof Error ? e.message : 'Unknown error occurred'}</div>`,
                    status: 'error' as const
                }))
            } : sess
        ));
    } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputValue, isLoading, sessions.length, selectedModel]);

  const handleSurpriseMe = () => {
      const currentPrompt = placeholders[placeholderIndex];
      setInputValue(currentPrompt);
      handleSendMessage(currentPrompt);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      event.preventDefault();
      handleSendMessage();
    } else if (event.key === 'Tab' && !inputValue && !isLoading) {
        event.preventDefault();
        setInputValue(placeholders[placeholderIndex]);
    }
  };

  const nextItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex < 2) setFocusedArtifactIndex(focusedArtifactIndex + 1);
      } else {
          if (currentSessionIndex < sessions.length - 1) setCurrentSessionIndex(currentSessionIndex + 1);
      }
  }, [currentSessionIndex, sessions.length, focusedArtifactIndex]);

  const prevItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex > 0) setFocusedArtifactIndex(focusedArtifactIndex - 1);
      } else {
           if (currentSessionIndex > 0) setCurrentSessionIndex(currentSessionIndex - 1);
      }
  }, [currentSessionIndex, focusedArtifactIndex]);

  const isLoadingDrawer = isLoading && drawerState.mode === 'variations' && componentVariations.length === 0;

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = sessions[currentSessionIndex];

  let canGoBack = false;
  let canGoForward = false;

  if (hasStarted) {
      if (focusedArtifactIndex !== null) {
          canGoBack = focusedArtifactIndex > 0;
          canGoForward = focusedArtifactIndex < (currentSession?.artifacts.length || 0) - 1;
      } else {
          canGoBack = currentSessionIndex > 0;
          canGoForward = currentSessionIndex < sessions.length - 1;
      }
  }

  return (
    <>
        <div className="model-toggle-container">
            <button 
                className={`model-toggle-btn ${selectedModel === 'gemini-3.1-flash-lite' ? 'active' : ''}`}
                onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
            >
                3.1 Flash Lite <span className="model-toggle-badge">Lite</span>
            </button>
            <button 
                className={`model-toggle-btn ${selectedModel === 'gemini-3.5-flash' ? 'active' : ''}`}
                onClick={() => setSelectedModel('gemini-3.5-flash')}
            >
                3.5 Flash <span className="model-toggle-badge">3.5</span>
            </button>
        </div>

        <a href="https://x.com/ammaar" target="_blank" rel="noreferrer" className={`creator-credit ${hasStarted ? 'hide-on-mobile' : ''}`}>
            created by @ammaar
        </a>

        <SideDrawer 
            isOpen={drawerState.isOpen} 
            onClose={() => setDrawerState(s => ({...s, isOpen: false}))} 
            title={drawerState.title}
        >
            {isLoadingDrawer && (
                 <div className="loading-state">
                     <ThinkingIcon /> 
                     Designing variations...
                 </div>
            )}

            {drawerState.mode === 'code' && (
                <pre className="code-block"><code>{drawerState.data}</code></pre>
            )}
            
            {drawerState.mode === 'variations' && (
                <div className="sexy-grid">
                    {componentVariations.map((v, i) => (
                         <div key={i} className="sexy-card" onClick={() => applyVariation(v.html)}>
                             <div className="sexy-preview">
                                 <iframe srcDoc={injectCustomBackground(v.html, getSelectedBackgroundImage(), motionDuration)} title={v.name} sandbox="allow-scripts allow-same-origin" />
                             </div>
                             <div className="sexy-label">{v.name}</div>
                         </div>
                    ))}
                </div>
            )}
        </SideDrawer>

        <div className="immersive-app">
            <DottedGlowBackground 
                gap={24} 
                radius={1.5} 
                color="rgba(255, 255, 255, 0.02)" 
                glowColor="rgba(255, 255, 255, 0.15)" 
                speedScale={0.5} 
            />

            {/* View Switcher Header */}
            <div className="view-switcher">
                <button 
                    className={`view-switch-btn ${activeView === 'library' ? 'active' : ''}`}
                    onClick={() => setActiveView('library')}
                >
                    Templates Library
                </button>
                <button 
                    className={`view-switch-btn ${activeView === 'studio' ? 'active' : ''}`}
                    onClick={() => setActiveView('studio')}
                >
                    Custom Studio
                </button>
            </div>

            {activeView === 'library' ? (
                <div className="templates-view">
                    <div className="templates-header">
                        <h1>Motion Templates Library</h1>
                        <p>Select a choreographed visual style, customize it with your script, and drop in your own custom footage</p>
                    </div>
                    <div className="templates-grid">
                        {OVERLAY_TEMPLATES.map(template => (
                            <div 
                                key={template.id} 
                                className="template-card" 
                                onClick={() => {
                                    setSelectedTemplate(template);
                                    setScriptText(template.defaultScript);
                                    setIsCustomizerOpen(true);
                                }}
                            >
                                <div className="template-card-image">
                                    <img src={template.previewImage} alt={template.title} />
                                    <div className="template-card-overlay">
                                        <div className="template-card-icon">{template.icon}</div>
                                    </div>
                                </div>
                                <div className="template-card-content">
                                    <h3 className="template-card-title">{template.title}</h3>
                                    <p className="template-card-description">{template.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                         <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                             <div className="empty-content">
                                 <h1>Motion Studio</h1>
                                 <p>Choreograph overlays on top of b-roll footage or start from our library</p>
                                 <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                     <button className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
                                         <SparklesIcon /> Surprise Me
                                     </button>
                                     <button className="surprise-button" style={{ background: '#18181b', border: '1px solid #27272a' }} onClick={() => setActiveView('library')}>
                                         📚 Choose Template
                                     </button>
                                 </div>
                             </div>
                         </div>

                        {sessions.map((session, sIndex) => {
                            let positionClass = 'hidden';
                            if (sIndex === currentSessionIndex) positionClass = 'active-session';
                            else if (sIndex < currentSessionIndex) positionClass = 'past-session';
                            else if (sIndex > currentSessionIndex) positionClass = 'future-session';
                            
                            return (
                                <div key={session.id} className={`session-group ${positionClass}`}>
                                    <div className="artifact-grid" ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
                                        {session.artifacts.map((artifact, aIndex) => {
                                            const isFocused = focusedArtifactIndex === aIndex;
                                            
                                            return (
                                                <ArtifactCard 
                                                    key={artifact.id}
                                                    artifact={{
                                                        ...artifact,
                                                        html: injectCustomBackground(artifact.html, getSelectedBackgroundImage(), motionDuration)
                                                    }}
                                                    isFocused={isFocused}
                                                    onClick={() => setFocusedArtifactIndex(aIndex)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                     {canGoBack && (
                        <button className="nav-handle left" onClick={prevItem} aria-label="Previous">
                            <ArrowLeftIcon />
                        </button>
                     )}
                     {canGoForward && (
                        <button className="nav-handle right" onClick={nextItem} aria-label="Next">
                            <ArrowRightIcon />
                        </button>
                     )}

                    <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                         <div className="active-prompt-label">
                            {currentSession?.prompt}
                         </div>
                         <div className="action-buttons">
                            <button onClick={() => setFocusedArtifactIndex(null)}>
                                <GridIcon /> Grid View
                            </button>
                            <button onClick={handleGenerateVariations} disabled={isLoading}>
                                <SparklesIcon /> Variations
                            </button>
                            <button onClick={handleShowCode}>
                                <CodeIcon /> Source
                            </button>
                         </div>
                    </div>

                    <div className="floating-input-container">
                        <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
                            {(!inputValue && !isLoading) && (
                                <div className="animated-placeholder" key={placeholderIndex}>
                                    <span className="placeholder-text">{placeholders[placeholderIndex]}</span>
                                    <span className="tab-hint">Tab</span>
                                </div>
                            )}
                            {!isLoading ? (
                                <input 
                                    ref={inputRef}
                                    type="text" 
                                    value={inputValue} 
                                    onChange={handleInputChange} 
                                    onKeyDown={handleKeyDown} 
                                    disabled={isLoading} 
                                />
                            ) : (
                                <div className="input-generating-label">
                                    <span className="generating-prompt-text">{currentSession?.prompt}</span>
                                    <ThinkingIcon />
                                </div>
                            )}
                            <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()}>
                                <ArrowUpIcon />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>

        {/* Customizer Modal Overlay */}
        {isCustomizerOpen && selectedTemplate && (
            <div className="customizer-overlay" onClick={() => setIsCustomizerOpen(false)}>
                <div className="customizer-modal" onClick={e => e.stopPropagation()}>
                    <div className="customizer-header">
                        <div className="customizer-title-group">
                            <span style={{ fontSize: '1.5rem', marginRight: '8px' }}>{selectedTemplate.icon}</span>
                            <h2 className="customizer-title">Customize {selectedTemplate.title}</h2>
                        </div>
                        <button className="customizer-close" onClick={() => setIsCustomizerOpen(false)} aria-label="Close modal">×</button>
                    </div>
                    <div className="customizer-body">
                        {/* YouTube Script Segment Section */}
                        <div className="customizer-section">
                            <label className="customizer-label">YouTube Script Segment</label>
                            <textarea 
                                className="customizer-textarea" 
                                value={scriptText} 
                                onChange={e => setScriptText(e.target.value)} 
                                placeholder="Type or paste a section of your YouTube script here. The AI will analyze it to extract content fitting the template style..."
                            />
                        </div>

                        {/* B-Roll Footage Background Selection Section */}
                        <div className="customizer-section">
                            <label className="customizer-label">Choose B-Roll Background Footage</label>
                            <div className="broll-picker">
                                <div className="broll-tabs">
                                    <button 
                                        type="button"
                                        className={`broll-tab-btn ${imageSourceType === 'curated' ? 'active' : ''}`}
                                        onClick={() => setImageSourceType('curated')}
                                    >
                                        Curated Footage
                                    </button>
                                    <button 
                                        type="button"
                                        className={`broll-tab-btn ${imageSourceType === 'upload' ? 'active' : ''}`}
                                        onClick={() => setImageSourceType('upload')}
                                    >
                                        Upload Custom Image
                                    </button>
                                    <button 
                                        type="button"
                                        className={`broll-tab-btn ${imageSourceType === 'url' ? 'active' : ''}`}
                                        onClick={() => setImageSourceType('url')}
                                    >
                                        External URL
                                    </button>
                                </div>

                                <div className="broll-tab-content" style={{ marginTop: '12px' }}>
                                    {imageSourceType === 'curated' && (
                                        <div className="broll-grid">
                                            {CURATED_BACKGROUNDS.map(bg => (
                                                <div 
                                                    key={bg.id} 
                                                    className={`broll-card ${selectedBrollId === bg.id ? 'active' : ''}`}
                                                    onClick={() => setSelectedBrollId(bg.id)}
                                                    style={{ backgroundImage: `url(${bg.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                                                >
                                                    <span className="broll-card-name">{bg.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {imageSourceType === 'upload' && (
                                        <div 
                                            className={`broll-upload-box ${isDraggingFile ? 'dragging' : ''} ${uploadedBase64 ? 'has-file' : ''}`}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                            style={{ border: '2px dashed #3f3f46', borderRadius: '8px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#09090b', position: 'relative', minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <input 
                                                type="file" 
                                                ref={fileInputRef} 
                                                style={{ display: 'none' }} 
                                                accept="image/*" 
                                                onChange={handleFileChange}
                                            />
                                            {uploadedBase64 ? (
                                                <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <img src={uploadedBase64} alt="Uploaded preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="upload-preview-overlay">
                                                        <span style={{ fontSize: '0.85rem', color: '#fff' }}>Drag or click to replace image</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ color: '#a1a1aa' }}>
                                                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📁</div>
                                                    <p style={{ fontSize: '0.9rem', fontWeight: 500, color: '#fff', marginBottom: '4px' }}>Drag & drop your custom background image here</p>
                                                    <p style={{ fontSize: '0.8rem', color: '#71717a' }}>or click to browse your local device</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {imageSourceType === 'url' && (
                                        <div className="broll-url-input-container">
                                            <input 
                                                type="text" 
                                                className="broll-url-input" 
                                                placeholder="https://example.com/your-broll-image.jpg" 
                                                value={customImageUrl}
                                                onChange={e => setCustomImageUrl(e.target.value)}
                                                style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', padding: '10px 12px', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                                            />
                                            <p className="broll-url-hint" style={{ fontSize: '0.8rem', color: '#71717a', marginTop: '6px' }}>Provide a direct path link to any public jpeg/png b-roll background image.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Motion Duration Section */}
                        <div className="customizer-section form-group">
                            <div className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="customizer-label" style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', margin: 0 }}>Motion Duration</span>
                                <span style={{ fontFamily: 'monospace', color: '#DA7756', fontSize: '0.9rem', fontWeight: 600 }}>{motionDuration}s</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#71717a' }}>Fast (2s)</span>
                                <input 
                                    type="range" 
                                    min="2" 
                                    max="30" 
                                    value={motionDuration} 
                                    onChange={e => setMotionDuration(parseInt(e.target.value, 10))}
                                    style={{ 
                                        flex: 1, 
                                        accentColor: '#DA7756', 
                                        background: 'rgba(255,255,255,0.1)', 
                                        height: '6px', 
                                        borderRadius: '3px',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }} 
                                />
                                <span style={{ fontSize: '0.8rem', color: '#71717a' }}>Slow (30s)</span>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#71717a', marginTop: '6px', marginBottom: 0, lineHeight: 1.4 }}>
                                Controls the panning and scaling animation speed of the background footage inside the video frame.
                            </p>
                        </div>
                    </div>
                    <div className="customizer-footer">
                        <button className="customizer-btn-cancel" onClick={() => setIsCustomizerOpen(false)}>Cancel</button>
                        <button 
                            className="customizer-btn-generate" 
                            onClick={() => handleGenerateCustomOverlay(selectedTemplate)}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Choreographing...' : 'Generate Personalized Animation'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}