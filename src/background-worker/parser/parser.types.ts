import { JitenToken } from '@shared/jiten/types';

export type Handle = {
  text: string;
  length: number;
  resolve: (tokens: JitenToken[]) => void;
  reject: (e?: Error) => void;
};

export type Batch = {
  strings: string[];
  handles: Handle[];
};
