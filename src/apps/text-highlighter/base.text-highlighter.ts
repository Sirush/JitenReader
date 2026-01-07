import { JitenToken } from '@shared/jiten/types';
import { Fragment } from '../batches/types';

export abstract class BaseTextHighlighter {
  constructor(
    protected fragments: Fragment[],
    protected tokens: JitenToken[],
  ) {}

  public abstract apply(): void;
}
