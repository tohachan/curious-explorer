import { GoogleGenAI, Type } from "@google/genai";
import { ExploredItem, ItemPart, ItemImages, ItemCharacteristic, GenerationOptions } from "../types";

let userApiKey = '';

export const setUserApiKey = (key: string) => {
  userApiKey = key;
};

// Helper to get API key safely
const getApiKey = (): string => {
  // Priority: Manually entered key -> Environment key
  return userApiKey || process.env.API_KEY || '';
};

// Clean JSON response helper
const cleanJsonString = (text: string): string => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

/**
 * 0. IDENTIFICATION PHASE (Vision)
 */
export const identifyMainObject = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key required for identification");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = imageBase64.split(',')[1];
    
    const prompt = "Identify the single main object in this image. Return ONLY the name of the object. No punctuation, no extra words.";
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: prompt }
        ]
      }
    });
    
    return response.text?.trim() || "Unknown Object";
  } catch (error) {
    console.error("Object identification failed:", error);
    throw new Error("Failed to identify object.");
  }
};

/**
 * 1. ANALYSIS PHASE
 */
interface StructureAnalysis {
  id: string;
  name: string;
  category: string;
  description: string;
  partNames: string[];
  facts: string[];
  characteristics: ItemCharacteristic[];
}

export const analyzeStructure = async (
  query: string, 
  options: GenerationOptions = { perspective: 'General', style: 'Default', detailLevel: 'Normal' }
): Promise<StructureAnalysis> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key required for analysis");

  try {
    const ai = new GoogleGenAI({ apiKey });

    const { perspective = 'General' } = options;
    let perspectivePrompt = "";
    
    if (perspective === 'Industrial') {
      perspectivePrompt = `
      ADOPT AN INDUSTRIAL ENGINEERING PERSPECTIVE.
      - Description: Focus on heavy-duty construction, materials, and durability.
      - Facts: Focus on manufacturing processes, tolerances, and industrial applications.
      - Specs: Focus on load capacity, material grade, power consumption, or operating limits.
      `;
    } else if (perspective === 'Scientific') {
      perspectivePrompt = `
      ADOPT A SCIENTIFIC RESEARCH PERSPECTIVE.
      - Description: Focus on chemical/biological composition, anatomy, or physics principles.
      - Facts: Focus on taxonomy, molecular structure, or scientific history.
      - Specs: Focus on precise measurements, chemical formulas, or biological classification.
      `;
    } else if (perspective === 'Conceptual') {
      perspectivePrompt = `
      ADOPT A CONCEPTUAL / FUTURISTIC PERSPECTIVE.
      - Description: Focus on abstract form, theoretical function, and energy dynamics.
      - Facts: Focus on potential future evolution, symbolic meaning, or theoretical physics.
      - Specs: Focus on energy output, theoretical efficiency, or abstract dimensions.
      `;
    }

    const prompt = `
      Analyze the object: "${query}".
      ${perspectivePrompt}

      1. Classify its category (e.g., Food, Electronics, Biological, Mechanical, etc.).
      2. Write a brief technical description (max 20 words).
      3. Identify 5-7 distinct major internal components that would be visible in an exploded view.
      4. List 3-5 short, interesting technical facts about this object.
      5. Based on the category, provide 3-6 key characteristics/specs:
         - If Food: Nutrition facts (Calories, Protein, Fat, Sugar).
         - If Electronics/Mechanical: Technical specs (Power, Material, Dimensions, Speed).
         - If Biological: Biological stats (Lifespan, Habitat, Kingdom, Average Size).
         - If Other: Relevant metrics.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            partNames: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            facts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            characteristics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING }
                },
                required: ["label", "value"]
              }
            }
          },
          required: ["name", "category", "description", "partNames", "facts", "characteristics"]
        }
      }
    });

    const text = cleanJsonString(response.text || "{}");
    const data = JSON.parse(text);

    return {
      id: Date.now().toString(),
      name: data.name || query,
      category: data.category || "Unknown",
      description: data.description || "No description.",
      partNames: data.partNames || [],
      facts: data.facts || [],
      characteristics: data.characteristics || []
    };

  } catch (error) {
    console.error("Structure analysis failed:", error);
    throw new Error("Failed to analyze object structure.");
  }
};

/**
 * 2. IMAGE GENERATION PIPELINE
 * Generates Assembled, Cutaway, and Exploded views.
 */

// Dynamic Anchor Block Builder
const buildAnchorBlock = (options: GenerationOptions = { perspective: 'General', style: 'Default', detailLevel: 'Normal' }): string => {
  const { 
    perspective = 'General', 
    style = 'Default', 
    detailLevel = 'Normal' 
  } = options;

  // 1. Style Logic (Visual Rendering)
  let styleDesc = "Clean semi-realistic visualization with clean lines.";
  let textureDesc = "Smooth surfaces.";

  if (style === 'Schematic') {
    styleDesc = "Technical blueprint wireframe style, neon blue outlines, transparent structures.";
    textureDesc = "Holographic wireframe, no solid textures.";
  } else if (style === 'Drawing') {
    styleDesc = "Digital concept art sketch, artistic strokes, technical illustration style.";
    textureDesc = "Hand-drawn shading effects with digital ink.";
  }

  // 2. Perspective/Context Logic (Vibe & Focus)
  let contextInstruction = "";
  if (perspective === 'Industrial') {
    contextInstruction = "Design Aesthetic: Heavy machinery, exposed bolts, hydraulics, raw steel and carbon fiber materials.";
  } else if (perspective === 'Scientific') {
    contextInstruction = "Design Aesthetic: Laboratory precision, sterile clean look, focus on internal anatomy or molecular structure.";
  } else if (perspective === 'Conceptual') {
    contextInstruction = "Design Aesthetic: Abstract futuristic interpretation, glowing energy cores, floating distinct symbolic parts.";
  }
  // 'General' leaves contextInstruction empty (default behavior)

  // 3. Detail Logic (Complexity)
  let detailInstruction = "";
  if (detailLevel === 'Simple') {
    detailInstruction = "Complexity: LOW. Simplified geometry. Merge small parts into larger blocks. Show only 2-3 main components.";
  } else if (detailLevel === 'Detailed') {
    detailInstruction = "Complexity: HIGH. Extreme mechanical intricacy. Show small screws, cables, circuits, and sub-mechanisms. 9-10 distinct components.";
  }
  // 'Normal' leaves detailInstruction empty (default behavior)

  // Base background matches original "Dark charcoal grey... blue coordinate grid"
  // ensuring the app's theme consistency across all styles.
  return `
Style: ${styleDesc}
Texture: ${textureDesc}
${contextInstruction}
${detailInstruction}
Lighting: Ambient occlusion lighting to eliminate harsh shadows and ensure all crevices are visible.
Background: Dark charcoal grey backdrop with heavy vignetting at the edges and a faint, semi-transparent holographic blue coordinate grid overlay.
Viewpoint: Strict isometric view at exactly 45 degrees. The object is centered and fills 70% of the frame.
Quality: High definition, sharp edges, minimalist aesthetic.
`;
};

const generateImage = async (prompt: string, referenceImageBase64?: string): Promise<string | undefined> => {
  const apiKey = getApiKey();
  if (!apiKey) return undefined;

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let parts: any[] = [{ text: prompt }];

    if (referenceImageBase64) {
      parts.unshift({
        inlineData: {
          mimeType: 'image/png',
          data: referenceImageBase64.split(',')[1]
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  } catch (error) {
    console.error("Image generation failed for prompt:", prompt.slice(0, 50), error);
    return undefined;
  }
};

export const generateVisualAssets = async (
  subject: string, 
  partNames: string[], 
  mode: 'fast' | 'full',
  initialReferenceImage?: string,
  options: GenerationOptions = { perspective: 'General', style: 'Default', detailLevel: 'Normal' }
): Promise<ItemImages | undefined> => {
  
  if (!getApiKey()) return undefined;

  // Generate ANCHOR_BLOCK based on options
  const DYNAMIC_ANCHOR = buildAnchorBlock(options);

  // Filter parts: Exclude parts that contain the subject name to avoid recursive naming issues
  const subjectTokens = subject.toLowerCase().split(' ');
  const safePartNames = partNames.filter(part => {
    const partLower = part.toLowerCase();
    // Exclude if the part name is exactly one of the subject tokens
    if (subjectTokens.includes(partLower)) return false;
    return true;
  });

  const refInstruction = initialReferenceImage 
    ? `Take the ${subject} from the provided picture and generate a new one very similar to it.` 
    : '';

  const promptExplodedContent = `
    Subject: A detailed volumetric deconstruction of ${subject}.
    The structure consists of the following separated components: ${safePartNames.join(', ')}.
    Layout requirement: The parts are pulled apart along the central axis (exploded view) but retain their relative alignment to the center.
    Annotation Style: Include clean, thin, semi-transparent white technical leader lines extending from the major components into the surrounding negative space.
    Constraint: Annotations should never be repeated for the same element.
    ${DYNAMIC_ANCHOR}
  `;

  // === FAST MODE: Skip Assembled/Cutaway ===
  if (mode === 'fast') {
     const prompt = `
        [EXPLODED_VIEW]:
        ${refInstruction}
        ${promptExplodedContent}
     `;
     const exploded = await generateImage(prompt, initialReferenceImage);
     if (!exploded) return undefined;
     return { exploded };
  }

  // === FULL MODE: Assembled -> Cutaway + Exploded (with Ref) ===
  const promptAssembled = `
    [ASSEMBLED_VIEW]:
    ${refInstruction}
    Subject: A pristine, whole ${subject}.
    Condition: Everything is intact. No parts are removed or displaced. The object looks solid and unified.
    ${DYNAMIC_ANCHOR}
  `;
  
  // Generate assembled view (using initial reference if provided)
  const assembled = await generateImage(promptAssembled, initialReferenceImage);
  if (!assembled) return undefined;

  const promptCutaway = `
    [CUTAWAY_VIEW]:
    Use this image as a strict reference for geometry and angle. Generate the exact same object but with a cutaway section revealing the insides.
    Subject: A technical cross-section cutaway view of a ${subject}.
    Condition: The object remains in the exact same position and angle as the assembled version. A precise 90-degree slice is removed from the front quadrant to reveal the internal mechanisms inside the shell. The outer silhouette remains largely intact to show context.
    ${DYNAMIC_ANCHOR}
  `;

  const promptExplodedWithRef = `
    [EXPLODED_VIEW]:
    Use this image as a reference. Explode these exact parts outward.
    ${promptExplodedContent}
  `;

  // Execute concurrently using the Generated Assembled View as reference
  const [cutaway, exploded] = await Promise.all([
    generateImage(promptCutaway, assembled),
    generateImage(promptExplodedWithRef, assembled)
  ]);

  return {
    assembled: assembled,
    cutaway: cutaway || assembled, // Fallback to assembled if fail
    exploded: exploded || assembled  // Fallback to assembled if fail
  };
};

/**
 * 3. SCANNING PHASE (Vision)
 * Scans the EXPLODED view for parts.
 */
export const detectPartCoordinates = async (
  explodedImageBase64: string, 
  partNames: string[]
): Promise<ItemPart[]> => {
  if (!explodedImageBase64 || !getApiKey()) return [];
  
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // Convert data URL to base64 string only
    const base64Data = explodedImageBase64.split(',')[1];

    const prompt = `
      Look at this technical exploded view diagram. 
      Identify the specific screen coordinates for the following labeled parts: ${partNames.join(', ')}.
      
      For each part found, return:
      - The exact name from the list.
      - A short 1-sentence visual description of what it looks like in this specific image.
      - The X and Y coordinates (0-100) representing the CENTER of the component (not the text label).
      
      CRITICAL COORDINATE SYSTEM INSTRUCTION:
      - X=0 is the LEFT edge, X=100 is the RIGHT edge.
      - Y=0 is the TOP edge, Y=100 is the BOTTOM edge.
      - Do not use cartesian coordinates where Y=0 is the bottom.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
            },
            required: ["name", "description", "x", "y"]
          }
        }
      }
    });

    const text = cleanJsonString(response.text || "[]");
    const partsData = JSON.parse(text);

    return partsData.map((p: any, index: number) => ({
      id: `${Date.now()}-${index}`,
      name: p.name,
      description: p.description,
      x: p.x,
      y: p.y
    }));

  } catch (error) {
    console.error("Coordinate detection failed:", error);
    return [];
  }
};