import { useTable, useList } from '@refinedev/core';

type TTable = ReturnType<typeof useTable>;
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
const a: Expand<TTable> = 1;
const b: Expand<ReturnType<typeof useList>> = 1;
