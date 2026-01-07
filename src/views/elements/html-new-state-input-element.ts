import { JitenCardState, LabeledCardState } from '@shared/jiten/types';
import { CheckboxListInput } from './lib/checkbox-list.input';

const LABELED_CARD_STATES: LabeledCardState[] = [
  {
    id: JitenCardState.NEW,
    name: 'New',
    description: 'Card has never been reviewed or is in the initial learning phase.',
  },
  {
    id: JitenCardState.YOUNG,
    name: 'Young',
    description: 'Card has been reviewed but has not yet reached maturity.',
  },
  {
    id: JitenCardState.MATURE,
    name: 'Mature',
    description: 'Card has been reviewed enough times to be considered well-known.',
  },
  {
    id: JitenCardState.DUE,
    name: 'Due',
    description: "Card's review interval has lapsed and it's ready for another review.",
  },
];

export class HTMLNewStateInputElement extends CheckboxListInput<LabeledCardState> {
  protected allowInspect = false;
  protected invertList = false;

  protected getRows(): LabeledCardState[] {
    return LABELED_CARD_STATES;
  }
}
