import type { Difference, ExtractedPdfPage } from '../types/comparison';

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
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
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
  return {
    id: `difference-${id}-modified`,
    type: 'modified',
    pageA: getFirstPage(deletedBlocks),
    pageB: getFirstPage(addedBlocks),
    textBefore: joinBlockText(deletedBlocks),
    textAfter: joinBlockText(addedBlocks),
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
