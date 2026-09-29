import { MessageSender } from '@shared/extension/types';
import { JitenToken } from '@shared/jiten/types';

export type Handle = {
  sequenceId: number;
  sender: MessageSender;
  text: string;
  length: number;
  resolve: (tokens: JitenToken[]) => void;
  reject: (error: Error) => void;
};

export type Batch = {
  strings: string[];
  handles: Handle[];
};
