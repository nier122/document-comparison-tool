export type DifferenceType = 'added' | 'removed' | 'modified';

export type Difference = {
  id: string;
  type: DifferenceType;
  pageA?: number;
  pageB?: number;
  textA?: string;
  textB?: string;
};
