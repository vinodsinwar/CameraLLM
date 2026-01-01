import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Lazy initialization
let genAI = null;
let visionModel = null;

const getGeminiClient = () => {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
  return visionModel;
};

/**
 * Convert base64 data URL to format Gemini can use
 */
const convertBase64ToGeminiFormat = (base64DataUrl) => {
  const base64Data = base64DataUrl.split(',')[1];
  const mimeType = base64DataUrl.match(/data:image\/([^;]+);/)?.[1] || 'jpeg';
  
  return {
    inlineData: {
      data: base64Data,
      mimeType: `image/${mimeType}`
    }
  };
};

/**
 * Add timeout wrapper for API calls
 */
const withTimeout = (promise, timeoutMs = 120000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

/**
 * Analyze multiple images and return concise Q&A format
 * Splits into batches if too many images
 * @param {Function} progressCallback - Optional callback for progress updates
 */
export const analyzeMultipleImages = async (images, progressCallback = null) => {
  try {
    const model = getGeminiClient();

    if (!images || images.length === 0) {
      throw new Error('No images provided');
    }

    // Gemini API has limits - process in batches of 10 images
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      batches.push(images.slice(i, i + BATCH_SIZE));
    }

    console.log(`[BATCH_ANALYZE] Processing ${images.length} images in ${batches.length} batch(es)`);

    // Emit initial progress
    if (progressCallback) {
      progressCallback({
        stage: 'initializing',
        message: `Preparing to analyze ${images.length} images...`,
        totalBatches: batches.length,
        currentBatch: 0,
        totalImages: images.length,
        processedImages: 0
      });
    }

    // Process batches sequentially and combine results
    const allResults = [];
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const processedImages = batchIndex * BATCH_SIZE;
      
      console.log(`[BATCH_ANALYZE] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} images)`);
      
      // Emit batch start progress
      if (progressCallback) {
        progressCallback({
          stage: 'analyzing',
          message: `Analyzing batch ${batchIndex + 1} of ${batches.length}...`,
          totalBatches: batches.length,
          currentBatch: batchIndex + 1,
          totalImages: images.length,
          processedImages: processedImages,
          currentBatchImages: batch.length
        });
      }
      
      try {
        const batchResult = await withTimeout(
          analyzeBatch(batch, batchIndex === 0 ? images.length : null),
          120000 // 2 minute timeout per batch
        );
        allResults.push(batchResult);
        
        // Emit batch complete progress
        if (progressCallback) {
          progressCallback({
            stage: 'analyzing',
            message: `Completed batch ${batchIndex + 1} of ${batches.length}`,
            totalBatches: batches.length,
            currentBatch: batchIndex + 1,
            totalImages: images.length,
            processedImages: processedImages + batch.length,
            currentBatchImages: batch.length
          });
        }
      } catch (batchError) {
        console.error(`[BATCH_ANALYZE] Error in batch ${batchIndex + 1}:`, batchError);
        // Continue with other batches even if one fails
        allResults.push(`\n[Batch ${batchIndex + 1} failed: ${batchError.message}]\n`);
        
        // Emit batch error progress
        if (progressCallback) {
          progressCallback({
            stage: 'error',
            message: `Batch ${batchIndex + 1} failed, continuing...`,
            totalBatches: batches.length,
            currentBatch: batchIndex + 1,
            totalImages: images.length,
            processedImages: processedImages + batch.length,
            error: batchError.message
          });
        }
      }
    }

    // Emit final progress
    if (progressCallback) {
      progressCallback({
        stage: 'finalizing',
        message: 'Combining results...',
        totalBatches: batches.length,
        currentBatch: batches.length,
        totalImages: images.length,
        processedImages: images.length
      });
    }

    // Combine all batch results
    return allResults.join('\n\n');
  } catch (error) {
    console.error('Error analyzing multiple images:', error);
    throw new Error(`Batch analysis failed: ${error.message}`);
  }
};

/**
 * Analyze a single batch of images
 */
const analyzeBatch = async (images, totalImageCount = null) => {
  const model = getGeminiClient();

    // Prepare prompt for batch analysis
    const imageCountText = totalImageCount ? `${images.length} images (part of ${totalImageCount} total)` : `${images.length} images`;
    const prompt = `You are analyzing ${imageCountText} sequential screenshots captured from a laptop screen. These images collectively contain multiple multiple-choice questions (MCQs).

IMPORTANT NOTES:
- A single question may appear partially across multiple images (split across screenshots)
- Some questions may appear more than once (duplicate screenshots)
- Some images may contain overlapping or missing text
- Questions may be cut off or split between images

YOUR TASK:
1. Analyze ALL images together as one cohesive set
2. Identify ALL unique questions by:
   - Merging partial or split question text across images
   - Combining text fragments that belong to the same question
   - Removing duplicate questions (same question appearing in multiple images)
3. For each final unique question:
   - Analyze the question and find the answer from the multiple choice options
   - Identify the correct answer(s) ONLY if visible or clearly inferable
   - If the answer is NOT visible or cannot be determined, state "Answer not visible"

OUTPUT FORMAT (EXACTLY as shown):
total number of questions : X

question 1 - answer a
question 2 - answer a and b
question 3 - answer d
question 4 - answer not visible
question 5 - answer c
...

CRITICAL RULES:
- Start with "total number of questions : X" where X is the count of unique questions
- Use lowercase: "question X - answer Y" (not "Question" or "Answer")
- For single answer: "question 1 - answer a"
- For multiple answers: "question 2 - answer a and b" (use "and" not commas)
- If answer not visible: "question 4 - answer not visible"
- NO explanations, NO descriptions, NO code blocks
- NO duplicate questions (each question appears only once)
- Merge partial questions that are split across images
- Number questions sequentially starting from 1

Do NOT:
- Describe the images or screenshots
- Provide explanations or reasoning
- Show code or calculations
- Include duplicate questions
- Use "Question" or "Answer" (use lowercase)
- Add any other text before or after the list

Return ONLY the output in the exact format specified above.`;

    // Convert all images to Gemini format
    const imageParts = images.map(img => convertBase64ToGeminiFormat(img));

    // Combine prompt with all images
    const parts = [
      { text: prompt },
      ...imageParts
    ];

    const result = await model.generateContent(parts);
    const response = await result.response;
    const analysis = response.text() || 'No analysis available';

    // Post-process to ensure format is correct and remove duplicates
    const formattedAnalysis = formatBatchAnalysis(analysis);

    return formattedAnalysis;
  } catch (error) {
    console.error('Error analyzing multiple images:', error);
    
    // Fallback: try with gemini-2.5-flash if gemini-3-flash fails
    if (error.message && (error.message.includes('gemini-3-flash') || error.message.includes('404'))) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const imageParts = images.map(img => convertBase64ToGeminiFormat(img));
        const parts = [
          { text: prompt },
          ...imageParts
        ];
        const result = await fallbackModel.generateContent(parts);
        const response = await result.response;
        const analysis = response.text() || 'No analysis available';
        return formatBatchAnalysis(analysis);
      } catch (fallbackError) {
        throw new Error(`Batch analysis failed: ${fallbackError.message}`);
      }
    }
    
    throw new Error(`Batch analysis failed: ${error.message}`);
  }
};

/**
 * Format and deduplicate the batch analysis response
 */
const formatBatchAnalysis = (analysis) => {
  if (!analysis) return 'total number of questions : 0';

  const lines = analysis.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Find the total count line
  let totalCount = 0;
  const totalMatch = analysis.match(/total\s+number\s+of\s+questions\s*:\s*(\d+)/i);
  if (totalMatch) {
    totalCount = parseInt(totalMatch[1], 10);
  }

  // Extract question lines (case-insensitive matching)
  const questionLines = lines.filter(line => {
    // Match: "question X - answer Y" or "question X - answer not visible"
    return /^question\s+\d+\s*-\s*answer\s+[a-z0-9\s]+(?:and\s+[a-z0-9\s]+)?(?:not\s+visible)?$/i.test(line);
  });

  if (questionLines.length === 0) {
    // If no properly formatted lines, return as-is but try to extract
    return analysis;
  }

  // Parse and deduplicate questions
  const questionMap = new Map(); // Use Map to preserve order and deduplicate

  for (const line of questionLines) {
    // Match: "question X - answer Y" or "question X - answer not visible"
    const match = line.match(/^question\s+(\d+)\s*-\s*answer\s+(.+)$/i);
    if (match) {
      const questionNum = parseInt(match[1], 10);
      const answer = match[2].trim().toLowerCase();
      
      // Use question number as key to detect duplicates (same question number = duplicate)
      // But we want to keep unique questions, so we'll use the answer text as part of the key
      // Actually, we should deduplicate based on question content, but since we only have numbers,
      // we'll assume the LLM already merged duplicates. We just need to ensure sequential numbering.
      
      // Store with lowercase format
      questionMap.set(questionNum, `question ${questionNum} - answer ${answer}`);
    }
  }

  // Convert to array and renumber sequentially
  const sortedQuestions = Array.from(questionMap.values())
    .sort((a, b) => {
      const numA = parseInt(a.match(/question\s+(\d+)/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/question\s+(\d+)/i)?.[1] || '0', 10);
      return numA - numB;
    })
    .map((line, index) => {
      const match = line.match(/question\s+\d+\s*-\s*answer\s+(.+)$/i);
      if (match) {
        return `question ${index + 1} - answer ${match[1]}`;
      }
      return line;
    });

  // Update total count to match actual questions found
  const finalCount = sortedQuestions.length;
  
  // Build final output
  const output = [
    `total number of questions : ${finalCount}`,
    ...sortedQuestions
  ];

  return output.join('\n');
};

