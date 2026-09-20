export function isContinuousMenu(state: {category: string; query?: string; sort?: string}): boolean;
export function activeMenuSection(sections: ReadonlyArray<{id: string; top: number}>, readingLine: number): string | null;
