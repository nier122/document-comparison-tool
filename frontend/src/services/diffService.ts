import type { Difference, DifferenceTextPart, ExtractedPdfPage } from '../types/comparison';

type TextBlock = {
  pageNumber: number;
  text: string;
  key: string;
  tokens: string[];
};

type DiffOperation =
  | {
      type: 'equal';
      blockA: TextBlock;
      blockB: TextBlock;
    }
  | {
      type: 'delete';
      block: TextBlock;
    }
  | {
      type: 'add';
      block: TextBlock;
    };

const MIN_MEANINGFUL_KEY_LENGTH = 3;
const MODIFIED_SIMILARITY_THRESHOLD = 0.35;

function normalizeDisplayText(text: string) {
  return text
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-z])-\s+([A-Za-z])/g, '$1$2')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function createComparisonKey(text: string) {
  return normalizeDisplayText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeKey(key: string) {
  if (key.length === 0) {
    return [];
  }

  return key.split(' ');
}

function isMeaningfulKey(key: string) {
  return key.replace(/\s/g, '').length >= MIN_MEANINGFUL_KEY_LENGTH;
}

function splitIntoBlocks(text: string) {
  const normalized = normalizeDisplayText(text);

  if (normalized.length === 0) {
    return [];
  }

  const sentenceMatches = normalized.match(/[^.!?;:]+(?:[.!?;:]+["')\]]*)?/g) ?? [normalized];

  return sentenceMatches.map((block) => normalizeDisplayText(block)).filter(Boolean);
}

function createBlocks(pages: ExtractedPdfPage[]) {
  return pages.flatMap((page) =>
    splitIntoBlocks(page.text)
      .map((text) => {
        const key = createComparisonKey(text);

        return {
          pageNumber: page.pageNumber,
          text,
          key,
          tokens: tokenizeKey(key),
        };
      })
      .filter((block) => isMeaningfulKey(block.key)),
  );
}

function buildLcsTable(blocksA: TextBlock[], blocksB: TextBlock[]) {
  const table = Array.from({ length: blocksA.length + 1 }, () =>
    Array.from({ length: blocksB.length + 1 }, () => 0),
  );

  for (let indexA = blocksA.length - 1; indexA >= 0; indexA -= 1) {
    for (let indexB = blocksB.length - 1; indexB >= 0; indexB -= 1) {
      if (blocksA[indexA].key === blocksB[indexB].key) {
        table[indexA][indexB] = table[indexA + 1][indexB + 1] + 1;
      } else {
        table[indexA][indexB] = Math.max(table[indexA + 1][indexB], table[indexA][indexB + 1]);
      }
    }
  }

  return table;
}

function diffBlocks(blocksA: TextBlock[], blocksB: TextBlock[]) {
  const operations: DiffOperation[] = [];
  const lcsTable = buildLcsTable(blocksA, blocksB);
  let indexA = 0;
  let indexB = 0;

  while (indexA < blocksA.length && indexB < blocksB.length) {
    if (blocksA[indexA].key === blocksB[indexB].key) {
      operations.push({
        type: 'equal',
        blockA: blocksA[indexA],
        blockB: blocksB[indexB],
      });
      indexA += 1;
      indexB += 1;
    } else if (lcsTable[indexA + 1][indexB] >= lcsTable[indexA][indexB + 1]) {
      operations.push({
        type: 'delete',
        block: blocksA[indexA],
      });
      indexA += 1;
    } else {
      operations.push({
        type: 'add',
        block: blocksB[indexB],
      });
      indexB += 1;
    }
  }

  while (indexA < blocksA.length) {
    operations.push({
      type: 'delete',
      block: blocksA[indexA],
    });
    indexA += 1;
  }

  while (indexB < blocksB.length) {
    operations.push({
      type: 'add',
      block: blocksB[indexB],
    });
    indexB += 1;
  }

  return operations;
}

function getTokenSimilarity(blocksA: TextBlock[], blocksB: TextBlock[]) {
  const tokensA = new Set(blocksA.flatMap((block) => block.tokens));
  const tokensB = new Set(blocksB.flatMap((block) => block.tokens));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  });

  return (2 * overlap) / (tokensA.size + tokensB.size);
}

function joinBlockText(blocks: TextBlock[]) {
  return blocks.map((block) => block.text).join(' ');
}

function tokenizeText(text: string) {
  return normalizeDisplayText(text).match(/\S+/g) ?? [];
}

function getWordKey(word: string) {
  return word
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

function buildWordLcsTable(wordsA: string[], wordsB: string[]) {
  const table = Array.from({ length: wordsA.length + 1 }, () =>
    Array.from({ length: wordsB.length + 1 }, () => 0),
  );

  for (let indexA = wordsA.length - 1; indexA >= 0; indexA -= 1) {
    for (let indexB = wordsB.length - 1; indexB >= 0; indexB -= 1) {
      if (getWordKey(wordsA[indexA]) === getWordKey(wordsB[indexB])) {
        table[indexA][indexB] = table[indexA + 1][indexB + 1] + 1;
      } else {
        table[indexA][indexB] = Math.max(table[indexA + 1][indexB], table[indexA][indexB + 1]);
      }
    }
  }

  return table;
}

function appendPart(parts: DifferenceTextPart[], part: DifferenceTextPart) {
  if (part.text.length === 0) {
    return;
  }

  const previousPart = parts[parts.length - 1];

  if (previousPart?.type === part.type) {
    previousPart.text = `${previousPart.text} ${part.text}`;
  } else {
    parts.push(part);
  }
}

function getChangedText(parts: DifferenceTextPart[], type: DifferenceTextPart['type']) {
  return parts
    .filter((part) => part.type === type)
    .map((part) => part.text)
    .join(' ')
    .trim();
}

function createWordLevelDiff(textBefore: string, textAfter: string) {
  const wordsBefore = tokenizeText(textBefore);
  const wordsAfter = tokenizeText(textAfter);
  const lcsTable = buildWordLcsTable(wordsBefore, wordsAfter);
  const beforeParts: DifferenceTextPart[] = [];
  const afterParts: DifferenceTextPart[] = [];
  const inlineParts: DifferenceTextPart[] = [];
  let indexBefore = 0;
  let indexAfter = 0;

  while (indexBefore < wordsBefore.length && indexAfter < wordsAfter.length) {
    if (getWordKey(wordsBefore[indexBefore]) === getWordKey(wordsAfter[indexAfter])) {
      appendPart(beforeParts, { type: 'unchanged', text: wordsBefore[indexBefore] });
      appendPart(afterParts, { type: 'unchanged', text: wordsAfter[indexAfter] });
      appendPart(inlineParts, { type: 'unchanged', text: wordsAfter[indexAfter] });
      indexBefore += 1;
      indexAfter += 1;
    } else if (lcsTable[indexBefore + 1][indexAfter] >= lcsTable[indexBefore][indexAfter + 1]) {
      appendPart(beforeParts, { type: 'deleted', text: wordsBefore[indexBefore] });
      appendPart(inlineParts, { type: 'deleted', text: wordsBefore[indexBefore] });
      indexBefore += 1;
    } else {
      appendPart(afterParts, { type: 'added', text: wordsAfter[indexAfter] });
      appendPart(inlineParts, { type: 'added', text: wordsAfter[indexAfter] });
      indexAfter += 1;
    }
  }

  while (indexBefore < wordsBefore.length) {
    appendPart(beforeParts, { type: 'deleted', text: wordsBefore[indexBefore] });
    appendPart(inlineParts, { type: 'deleted', text: wordsBefore[indexBefore] });
    indexBefore += 1;
  }

  while (indexAfter < wordsAfter.length) {
    appendPart(afterParts, { type: 'added', text: wordsAfter[indexAfter] });
    appendPart(inlineParts, { type: 'added', text: wordsAfter[indexAfter] });
    indexAfter += 1;
  }

  return {
    beforeParts,
    afterParts,
    inlineParts,
    changedTextBefore: getChangedText(beforeParts, 'deleted'),
    changedTextAfter: getChangedText(afterParts, 'added'),
  };
}

function getFirstPage(blocks: TextBlock[]) {
  return blocks[0]?.pageNumber;
}

function createAddedDifference(id: number, blocks: TextBlock[]): Difference {
  return {
    id: `difference-${id}-added`,
    type: 'added',
    pageB: getFirstPage(blocks),
    textAfter: joinBlockText(blocks),
  };
}

function createDeletedDifference(id: number, blocks: TextBlock[]): Difference {
  return {
    id: `difference-${id}-deleted`,
    type: 'deleted',
    pageA: getFirstPage(blocks),
    textBefore: joinBlockText(blocks),
  };
}

function createModifiedDifference(
  id: number,
  deletedBlocks: TextBlock[],
  addedBlocks: TextBlock[],
): Difference {
  const textBefore = joinBlockText(deletedBlocks);
  const textAfter = joinBlockText(addedBlocks);
  const wordDiff = createWordLevelDiff(textBefore, textAfter);

  return {
    id: `difference-${id}-modified`,
    type: 'modified',
    pageA: getFirstPage(deletedBlocks),
    pageB: getFirstPage(addedBlocks),
    textBefore,
    textAfter,
    ...wordDiff,
  };
}

function pushMeaningfulChanges(
  differences: Difference[],
  deletedBlocks: TextBlock[],
  addedBlocks: TextBlock[],
) {
  if (deletedBlocks.length === 0 && addedBlocks.length === 0) {
    return;
  }

  const nextId = differences.length + 1;

  if (deletedBlocks.length === 0) {
    differences.push(createAddedDifference(nextId, addedBlocks));
    return;
  }

  if (addedBlocks.length === 0) {
    differences.push(createDeletedDifference(nextId, deletedBlocks));
    return;
  }

  if (getTokenSimilarity(deletedBlocks, addedBlocks) >= MODIFIED_SIMILARITY_THRESHOLD) {
    differences.push(createModifiedDifference(nextId, deletedBlocks, addedBlocks));
    return;
  }

  differences.push(createDeletedDifference(nextId, deletedBlocks));
  differences.push(createAddedDifference(nextId + 1, addedBlocks));
}

export function generateDifferences(
  pdfAPages: ExtractedPdfPage[],
  pdfBPages: ExtractedPdfPage[],
): Difference[] {
  const blocksA = createBlocks(pdfAPages);
  const blocksB = createBlocks(pdfBPages);
  const operations = diffBlocks(blocksA, blocksB);
  const differences: Difference[] = [];
  let deletedBlocks: TextBlock[] = [];
  let addedBlocks: TextBlock[] = [];

  operations.forEach((operation) => {
    if (operation.type === 'equal') {
      pushMeaningfulChanges(differences, deletedBlocks, addedBlocks);
      deletedBlocks = [];
      addedBlocks = [];
      return;
    }

    if (operation.type === 'delete') {
      deletedBlocks.push(operation.block);
      return;
    }

    addedBlocks.push(operation.block);
  });

  pushMeaningfulChanges(differences, deletedBlocks, addedBlocks);

  return differences;
}
